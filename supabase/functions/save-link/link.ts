// Reglas puras de save-link: la direccion y la clave que manda el atajo de
// iOS, la comparacion con lo ya guardado y la frase de la notificacion. Sin
// Deno ni Supabase, para testearlas con Vitest como record-price/record.ts.

const URL_IN_TEXT = /https?:\/\/[^\s<>"']+/i;

function httpUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Lo que llega de la hoja de compartir: una URL limpia desde Safari, o una
 * frase con la direccion dentro desde otras apps («Mira esto: https://…»).
 * Mismo criterio que readSharedUrl (src/lib/shareTarget.js). */
export function findUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 4000) return null;
  const direct = httpUrl(value);
  if (direct) return direct;
  const found = URL_IN_TEXT.exec(value);
  if (!found) return null;
  // Quita la puntuacion que suele pegarse al final de una frase.
  return httpUrl(found[0].replace(/[.,;:!?)\]]+$/, ""));
}

/** La clave del atajo tal y como la crea Ajustes (src/lib/shortcutKey.js). */
export function parseKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim();
  return /^vigia_[A-Za-z0-9_-]{43}$/.test(key) ? key : null;
}

/** SHA-256 en hexadecimal: en la BD solo se guarda esto, nunca la clave.
 * Copia de hashShortcutKey (src/lib/shortcutKey.js). */
export async function hashKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Copia de urlKey (src/lib/urlKey.js): dos direcciones del mismo articulo
// casi nunca se escriben igual. Si se cambia alli, aqui tambien.
const TRACKING_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid", "mc_eid", "ref", "tag", "_ga", "srsltid"];
const IGNORED_PREFIXES = [...TRACKING_PARAMS, "utm_", "_gl", "gad_", "gbraid", "wbraid", "dclid", "msclkid", "awc", "aw_affid", "sv1", "sv_campaign_id", "highlightedoffercode"];

export function urlKey(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const path = u.pathname.replace(/\/+$/, "").toLowerCase();
  const params = [...u.searchParams.entries()]
    .filter(([key]) => !IGNORED_PREFIXES.some((p) => key.toLowerCase().startsWith(p)))
    .sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return `${host}${path}${params ? `?${params}` : ""}`;
}

export interface VisibleItem {
  itm_usr_id: string;
  itm_url: string;
  itm_title: string | null;
}

/** El articulo que ya sea esta direccion. Como findExisting (useItems.js):
 * entre los propios y los de carpetas compartidas; si esta en los dos, gana
 * el propio. */
export function findSameItem<T extends VisibleItem>(items: T[], userId: string, url: string): T | null {
  const key = urlKey(url);
  if (!key) return null;
  const same = items.filter((item) => urlKey(item.itm_url) === key);
  return same.find((item) => item.itm_usr_id === userId) ?? same[0] ?? null;
}

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

function hostOf(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "");
}

/** Texto corto: lo ensena iOS en la notificacion del atajo. */
export function savedMessage(saved: { url: string; title: string | null; price: number | null; manual: boolean }): string {
  if (saved.manual) return `Guardado en Vigía sin precio: ${hostOf(saved.url)} no deja leerlo desde el servidor.`;
  const title = saved.title && saved.title !== saved.url ? saved.title : hostOf(saved.url);
  return saved.price != null ? `Guardado en Vigía: ${title} · ${eur.format(saved.price)}` : `Guardado en Vigía: ${title}`;
}

export function duplicateMessage(item: VisibleItem): string {
  const title = item.itm_title && item.itm_title !== item.itm_url ? item.itm_title : hostOf(item.itm_url);
  return `Ya lo tenías en Vigía: ${title}`;
}
