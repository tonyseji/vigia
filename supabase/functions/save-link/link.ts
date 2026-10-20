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
  // Tal cual solo si no hay nada mas: new URL() acepta «enlace + frase»
  // entera y la tienda contestaba 404 (sesion 42). Igual que findUrlInText.
  const direct = /\s/.test(value.trim()) ? null : httpUrl(value);
  if (direct) return direct;
  const found = URL_IN_TEXT.exec(value);
  if (!found) return null;
  // Quita la puntuacion que suele pegarse al final de una frase.
  return httpUrl(found[0].replace(/[.,;:!?)\]]+$/, ""));
}

/** La pagina abierta en Safari, si el atajo se lanzo desde alli: lo que
 * devuelve SHORTCUT_PAGE_SCRIPT (src/lib/shortcutKey.js) como texto JSON.
 * null si no vino o no vale; entonces se lee desde el servidor. */
export function parsePage(value: unknown): { href: string; canonical: string | null; html: string } | null {
  if (typeof value !== "string" || !value || value.length > 6_000_000) return null;
  let page: Record<string, unknown>;
  try {
    page = JSON.parse(value);
  } catch {
    return null;
  }
  const href = typeof page?.href === "string" ? httpUrl(page.href) : null;
  const html = typeof page?.html === "string" ? page.html : "";
  if (!href || html.length < 100) return null;
  const canonical = typeof page.canonical === "string" ? httpUrl(page.canonical) : null;
  return { href, canonical, html };
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

/** Copia de amazonProduct (src/lib/urlKey.js); record-price la importa de aqui: en Amazon el producto es el ASIN. */
export function amazonProduct(u: URL): string | null {
  if (!/(^|\.)amazon\.[a-z.]+$/i.test(u.hostname)) return null;
  const asin = u.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?=[/?]|$)/i)?.[1];
  return asin ? `${u.origin}/dp/${asin.toUpperCase()}` : null;
}

export function urlKey(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const amazon = amazonProduct(u);
  if (amazon) u = new URL(amazon);
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
export function savedMessage(saved: { url: string; title: string | null; price: number | null; manual: boolean; unread?: boolean }): string {
  // Tienda que bloquea al servidor; con precio, es que lo leyo Safari.
  if (saved.manual && saved.price == null) return `Guardado en Vigía sin precio: ${hostOf(saved.url)} no deja leerlo desde el servidor.`;
  // La lectura fallo por algo que puede salir bien mas tarde (sesion 42).
  if (saved.unread) return `Guardado en Vigía sin precio: ahora no he podido leer la ficha de ${hostOf(saved.url)}. Lo vuelvo a intentar en el próximo pase.`;
  const title = saved.title && saved.title !== saved.url ? saved.title : hostOf(saved.url);
  return saved.price != null ? `Guardado en Vigía: ${title} · ${eur.format(saved.price)}` : `Guardado en Vigía: ${title}`;
}

export function duplicateMessage(item: VisibleItem): string {
  const title = item.itm_title && item.itm_title !== item.itm_url ? item.itm_title : hostOf(item.itm_url);
  return `Ya lo tenías en Vigía: ${title}`;
}

// Copia de src/lib/itemGaps.js: volver a guardar un articulo al que le
// falta lo principal lo completa (docs/DECISIONES.md 2026-10-21). Si se
// cambia alli, aqui tambien.
export interface GapItem {
  itm_url: string;
  itm_title: string | null;
  itm_image_url: string | null;
  itm_price: number | null;
  itm_notified_price: number | null;
}

const PART_LABELS: Record<string, string> = { precio: "el precio", foto: "la foto", nombre: "el nombre" };

export function missingParts(item: GapItem): string[] {
  const parts: string[] = [];
  if (item.itm_price == null) parts.push("precio");
  if (!item.itm_image_url) parts.push("foto");
  if (!item.itm_title || item.itm_title === item.itm_url) parts.push("nombre");
  return parts;
}

export function missingText(parts: string[]): string {
  const words = parts.map((p) => PART_LABELS[p]);
  return words.length > 1 ? `${words.slice(0, -1).join(", ")} y ${words[words.length - 1]}` : (words[0] ?? "");
}

export function fillUpdate(
  existing: GapItem,
  read: { title?: string; image?: string; price?: number | null; inStock?: boolean | null },
  now: string,
): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  if (read.price != null) {
    update.itm_price = read.price;
    update.itm_in_stock = read.inStock ?? null;
    update.itm_is_manual = false;
    update.itm_last_checked_at = now;
    update.itm_last_error = null;
    if (existing.itm_notified_price != null && read.price > existing.itm_notified_price) {
      update.itm_notified_price = null;
      update.itm_notified_at = null;
    }
  }
  if (read.title && (!existing.itm_title || existing.itm_title === existing.itm_url)) update.itm_title = read.title;
  if (read.image && !existing.itm_image_url) update.itm_image_url = read.image;
  return update;
}

/** Ya estaba, le faltaba algo y la lectura nueva tampoco lo ha traido. */
export function stillMissingMessage(item: GapItem & VisibleItem, reason: string): string {
  return `${duplicateMessage(item)}. Le falta ${missingText(missingParts(item))}, pero ahora tampoco he podido leerlo: ${reason}`;
}

export function completedMessage(item: { itm_url: string; itm_title: string | null; itm_price: number | null }): string {
  const title = item.itm_title && item.itm_title !== item.itm_url ? item.itm_title : hostOf(item.itm_url);
  return item.itm_price != null ? `Completado en Vigía: ${title} · ${eur.format(item.itm_price)}` : `Completado en Vigía: ${title}`;
}
