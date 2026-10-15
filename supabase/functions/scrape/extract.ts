// Descarga de la ficha (perfiles de cabeceras, camino alternativo, enlaces
// cortos). La lectura del HTML está en parse.ts, que comparten la extensión
// y el botón de marcadores.
import { type Extracted, extractFromHtml, isBotPage } from "./parse.ts";

export * from "./parse.ts";

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

// Perfiles de cabeceras que se prueban en orden cuando una tienda bloquea (403/429/503)
export const HEADER_PROFILES: Record<string, string>[] = [
  {
    "User-Agent": CHROME_UA,
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "es-ES,es;q=0.9",
  },
  {
    "User-Agent": CHROME_UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.7",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "sec-ch-ua": '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
  },
  {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9",
  },
  {
    "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9",
  },
];

async function fetchOnce(url: string, headers: Record<string, string>, timeoutMs: number): Promise<{ status: number; html?: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { redirect: "follow", signal: ctrl.signal, headers });
    if (!res.ok) {
      await res.body?.cancel();
      return { status: res.status };
    }
    const buf = await res.arrayBuffer();
    // límite 3 MB
    const slice = buf.byteLength > 3_000_000 ? buf.slice(0, 3_000_000) : buf;
    return { status: res.status, html: new TextDecoder("utf-8").decode(slice) };
  } finally {
    clearTimeout(t);
  }
}

/** Camino alternativo de descarga (p. ej. vía pg_net desde Postgres, con otra IP). Lo registra index.ts */
export type AltFetcher = (url: string, headers: Record<string, string>) => Promise<{ status: number; html?: string }>;
let altFetcher: AltFetcher | null = null;
export function setAltFetcher(fn: AltFetcher) {
  altFetcher = fn;
}

const BLOCK_STATUSES = [401, 403, 429, 500, 502, 503];

/** El motivo en palabras llanas: la web y el atajo de iOS lo enseñan tal
 * cual. Un 404 no es un bloqueo: la página no existe (anuncio de segunda
 * mano ya retirado, o enlace copiado a medias). Antes decía «la tienda
 * bloquea» y la web lo tapaba con «Inténtalo de nuevo» (sesión 42). */
export function statusMessage(status: number): string {
  if (status === 404 || status === 410) {
    return `La tienda dice que esa página no existe (HTTP ${status}). Puede que el anuncio ya no esté o que el enlace esté incompleto.`;
  }
  if (BLOCK_STATUSES.includes(status)) return `HTTP ${status} (la tienda bloquea la lectura automática)`;
  return `La tienda respondió con un error (HTTP ${status}).`;
}

// Enlaces cortos de compartir (la app de Amazon da amzn.eu/d/...). Sin
// expandirlos el host no es amazon.* y no se aplica nada de lo específico de
// Amazon: ni pg_net, ni el control del interstitial, ni la lectura del precio.
const SHORT_LINK_HOST = /^(amzn\.(eu|to|com|asia)|a\.co)$/i;

/** La dirección a la que lleva un enlace corto; cualquier otra, tal cual.
 * Una ficha de Amazon queda en su forma corta (/dp/ASIN), sin los
 * parámetros de compartir. Si no se puede expandir, devuelve la de entrada. */
export async function expandShortLink(url: string, timeoutMs = 8000): Promise<string> {
  let current = url;
  for (let hop = 0; hop < 3 && SHORT_LINK_HOST.test(new URL(current).hostname); hop++) {
    try {
      // GET y no HEAD: amzn.eu responde 404 a HEAD.
      const res = await fetch(current, { redirect: "manual", headers: HEADER_PROFILES[0], signal: AbortSignal.timeout(timeoutMs) });
      await res.body?.cancel();
      const location = res.headers.get("location");
      if (!location) break;
      current = new URL(location, current).toString();
    } catch {
      break;
    }
  }
  if (current === url) return url;
  const u = new URL(current);
  const asin = /amazon\./i.test(u.hostname) && u.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)?.[1];
  return asin ? `${u.origin}/dp/${asin}` : current;
}

export async function fetchHtml(url: string, timeoutMs = 15000, profile?: number): Promise<string> {
  const profiles = profile != null ? [HEADER_PROFILES[profile] ?? HEADER_PROFILES[0]] : HEADER_PROFILES;
  let lastStatus = 0;
  let lastErr: unknown = null;
  // Amazon bloquea las IPs de las Edge Functions casi siempre: ir primero por el camino alternativo
  if (altFetcher && profile == null && /amazon\./i.test(new URL(url).hostname)) {
    try {
      const r = await altFetcher(url, HEADER_PROFILES[0]);
      if (r.html != null && !isBotPage(url, r.html)) return r.html;
    } catch (e) {
      lastErr = e;
    }
  }
  for (let i = 0; i < profiles.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 400));
    try {
      const r = await fetchOnce(url, profiles[i], timeoutMs);
      if (r.html != null) {
        if (!isBotPage(url, r.html)) return r.html;
        lastStatus = 403; // muro anti-bot con 200: seguimos probando
        continue;
      }
      lastStatus = r.status;
      if (!BLOCK_STATUSES.includes(r.status)) break; // 404 etc.: no tiene sentido reintentar
    } catch (e) {
      lastErr = e;
    }
  }
  // Bloqueo: intentar por el camino alternativo (otra IP de salida)
  if (altFetcher && (lastStatus === 0 || BLOCK_STATUSES.includes(lastStatus))) {
    try {
      const r = await altFetcher(url, HEADER_PROFILES[0]);
      if (r.html != null) {
        if (!isBotPage(url, r.html)) return r.html;
        lastStatus = 403;
      } else if (r.status) lastStatus = r.status;
    } catch (e) {
      lastErr = lastErr ?? e;
    }
  }
  if (lastStatus) throw new Error(statusMessage(lastStatus));
  throw new Error((lastErr as Error)?.name === "AbortError" ? "Tiempo de espera agotado" : (lastErr as Error)?.message || "Error de red");
}

export async function extractFromUrl(url: string, profile?: number): Promise<Extracted> {
  const real = await expandShortLink(url);
  const html = await fetchHtml(real, 15000, profile);
  return { ...extractFromHtml(html, real), ...(real !== url ? { url: real } : {}) };
}
