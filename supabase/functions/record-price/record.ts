// Reglas puras de record-price: validar lo que manda el navegador y decidir
// que se escribe en el articulo. Sin Deno ni Supabase, para testearlas con
// Vitest como refresh/notify.ts.

export interface PricePayload {
  url: string;
  /** La de la barra de direcciones, si no es la canonica. */
  altUrl: string | null;
  /** El pase de la extension sabe que articulo esta leyendo: va por id. */
  itemId: string | null;
  title: string | null;
  image: string | null;
  price: number;
  currency: string;
  inStock: boolean | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function httpUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2000) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Mismas reglas que parseImport (src/lib/browserImport.js): lo manda un
 * navegador, se valida todo. null si falta la URL o el precio no es valido. */
export function parsePricePayload(body: unknown): PricePayload | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const url = httpUrl(b.url);
  const price = typeof b.price === "number" ? b.price : NaN;
  if (!url || !Number.isFinite(price) || price < 0 || price >= 10_000_000) return null;
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 300) : "";
  const altUrl = httpUrl(b.altUrl);
  return {
    url,
    altUrl: altUrl !== url ? altUrl : null,
    itemId: typeof b.itemId === "string" && UUID_RE.test(b.itemId) ? b.itemId : null,
    title: title || null,
    image: httpUrl(b.image),
    price: Math.round(price * 100) / 100,
    currency: typeof b.currency === "string" && /^[A-Z]{3}$/.test(b.currency) ? b.currency : "EUR",
    inStock: typeof b.inStock === "boolean" ? b.inStock : null,
  };
}

const TRACKING_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid", "mc_eid", "ref", "tag", "_ga", "srsltid"];

/** Copia de cleanUrl (src/lib/urlKey.js): la misma URL tiene que dar el
 * mismo itm_url venga de la web o de la extension, o se duplicaria. */
export function cleanUrl(raw: string): string {
  const u = new URL(raw);
  u.hash = "";
  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING_PARAMS.some((d) => key.toLowerCase().startsWith(d))) u.searchParams.delete(key);
  }
  return u.toString();
}

export interface ExistingItem {
  itm_url: string;
  itm_title: string | null;
  itm_image_url: string | null;
  itm_notified_price: number | null;
}

/** Campos a actualizar en un articulo que ya estaba. Titulo e imagen solo se
 * rellenan si faltaban (un articulo guardado a mano tiene la URL de titulo);
 * lo que el usuario haya editado no se pisa. */
export function itemUpdate(existing: ExistingItem, data: PricePayload, manual: boolean, now: string): Record<string, unknown> {
  const update: Record<string, unknown> = {
    itm_price: data.price,
    itm_in_stock: data.inStock,
    itm_is_manual: manual,
    itm_last_checked_at: now,
    itm_last_error: null,
  };
  if (data.title && (!existing.itm_title || existing.itm_title === existing.itm_url)) update.itm_title = data.title;
  if (data.image && !existing.itm_image_url) update.itm_image_url = data.image;
  // Mismo criterio que refresh: si sube por encima del ultimo aviso, la
  // proxima bajada vuelve a avisar (notify.ts, resetsNotified).
  if (existing.itm_notified_price != null && data.price > existing.itm_notified_price) {
    update.itm_notified_price = null;
    update.itm_notified_at = null;
  }
  return update;
}
