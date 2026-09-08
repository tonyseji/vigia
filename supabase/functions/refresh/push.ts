// Web Push nativo con VAPID (RFC 8291 / RFC 8188), sin dependencias npm/deno.
// Portado literal de Bilans (supabase/functions/push-daily-reminder/index.ts):
// mismo estandar, misma implementacion con crypto.subtle. Ver docs/DECISIONES.md
// 2026-09-06, "Notificaciones push nativas (Web Push + VAPID), portadas de
// Bilans, no un servicio de terceros".
//
// Nota Deno: la clave privada ECDSA no se puede importar como 'raw'; se
// importa como JWK reconstruyendo x/y a partir de la clave publica
// uncompressed (65 bytes: 0x04 + 32 bytes x + 32 bytes y).

const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT")!;

function base64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    str.length + ((4 - (str.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((acc, a) => acc + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

async function buildVapidJwt(audience: string): Promise<string> {
  const header = base64urlEncode(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64urlEncode(
    new TextEncoder().encode(JSON.stringify({ aud: audience, exp: now + 43200, sub: VAPID_SUBJECT })),
  );
  const signingInput = `${header}.${payload}`;

  const pubKeyBytes = base64urlDecode(VAPID_PUBLIC_KEY);
  const x = base64urlEncode(pubKeyBytes.slice(1, 33));
  const y = base64urlEncode(pubKeyBytes.slice(33, 65));

  const privateKey = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", d: VAPID_PRIVATE_KEY, x, y, key_ops: ["sign"] },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64urlEncode(signature)}`;
}

async function encryptPayload(
  payload: string,
  clientPublicKeyBase64url: string,
  authBase64url: string,
): Promise<{ body: Uint8Array }> {
  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(payload);
  const clientPublicKeyBytes = base64urlDecode(clientPublicKeyBase64url);
  const authBytes = base64urlDecode(authBase64url);

  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"],
  );
  const serverPublicKey = new Uint8Array(await crypto.subtle.exportKey("raw", serverKeyPair.publicKey));

  const clientPublicKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: clientPublicKey }, serverKeyPair.privateKey, 256),
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const authInfo = concatBytes(encoder.encode("WebPush: info\x00"), clientPublicKeyBytes, serverPublicKey);
  const sharedSecretKey = await crypto.subtle.importKey("raw", sharedSecret, { name: "HKDF" }, false, ["deriveBits"]);
  const ikm = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: authBytes, info: authInfo }, sharedSecretKey, 256),
  );

  const ikmKey = await crypto.subtle.importKey("raw", ikm, { name: "HKDF" }, false, ["deriveBits"]);
  const cekInfo = encoder.encode("Content-Encoding: aes128gcm\x00");
  const nonceInfo = encoder.encode("Content-Encoding: nonce\x00");
  const cek = new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: cekInfo }, ikmKey, 128));
  const nonce = new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: nonceInfo }, ikmKey, 96));

  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const paddedPayload = concatBytes(payloadBytes, new Uint8Array([0x02]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, aesKey, paddedPayload),
  );

  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1 + serverPublicKey.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, rs, false);
  header[20] = serverPublicKey.length;
  header.set(serverPublicKey, 21);

  return { body: concatBytes(header, ciphertext) };
}

export interface PushSubscriptionRow {
  psub_id: string;
  psub_endpoint: string;
  psub_p256dh: string;
  psub_auth: string;
}

export interface PushResult {
  status: "sent" | "failed" | "gone";
  psub_id: string;
  httpStatus?: number;
}

export async function sendPush(sub: PushSubscriptionRow, payloadJson: string): Promise<PushResult> {
  try {
    const url = new URL(sub.psub_endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const vapidJwt = await buildVapidJwt(audience);
    const { body } = await encryptPayload(payloadJson, sub.psub_p256dh, sub.psub_auth);

    const res = await fetch(sub.psub_endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "TTL": "86400",
        "Authorization": `vapid t=${vapidJwt},k=${VAPID_PUBLIC_KEY}`,
      },
      body,
    });

    if (res.status === 410 || res.status === 404) {
      return { status: "gone", psub_id: sub.psub_id, httpStatus: res.status };
    }
    if (!res.ok) {
      return { status: "failed", psub_id: sub.psub_id, httpStatus: res.status };
    }
    return { status: "sent", psub_id: sub.psub_id, httpStatus: res.status };
  } catch {
    return { status: "failed", psub_id: sub.psub_id };
  }
}
