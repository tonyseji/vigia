// Dos direcciones del mismo artículo rara vez son idénticas: barra final,
// «www.», http/https, mayúsculas, parámetros de campaña... El índice único
// de items (itm_usr_id, itm_url) solo frena la idéntica, así que antes de
// guardar se compara por esta clave.

const TRACKING_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'mc_eid', 'ref', 'tag', '_ga', 'srsltid']

/** En Amazon el producto es el ASIN: la misma ficha llega como /dp/ASIN,
 * con ?th=1 o con el nombre y el rastro del buscador. Esta es la que se
 * guarda. null si no es una ficha de Amazon. Copiada en
 * supabase/functions/save-link/link.ts (record-price la importa de ahí). */
function amazonProduct(u) {
  if (!/(^|\.)amazon\.[a-z.]+$/i.test(u.hostname)) return null
  const asin = u.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?=[/?]|$)/i)?.[1]
  return asin ? `${u.origin}/dp/${asin.toUpperCase()}` : null
}

/** La dirección que se guarda en itm_url. Copiada en
 * supabase/functions/record-price/record.ts: la misma URL tiene que dar el
 * mismo itm_url venga de la web o de la extensión. Si se cambia aquí, allí
 * también. */
export function cleanUrl(raw) {
  const u = new URL(raw)
  const amazon = amazonProduct(u)
  if (amazon) return amazon
  u.hash = ''
  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING_PARAMS.some((d) => key.toLowerCase().startsWith(d))) u.searchParams.delete(key)
  }
  return u.toString()
}

// Solo para comparar, así que puede quitar más que cleanUrl sin descuadrar
// lo guardado: anuncios de Google/Microsoft, afiliados y el resto de utm_*.
const IGNORED_PREFIXES = [...TRACKING_PARAMS, 'utm_', '_gl', 'gad_', 'gbraid', 'wbraid', 'dclid', 'msclkid', 'awc', 'aw_affid', 'sv1', 'sv_campaign_id', 'highlightedoffercode']

/** Clave para decidir si dos direcciones son el mismo artículo: sin
 * esquema, sin «www.», sin barra final, sin hash, sin parámetros de
 * seguimiento y con el resto ordenados. Los parámetros que quedan se
 * respetan (en algunas tiendas eligen variante, p. ej. `id_c` en Sklum).
 * null si no es una URL. Copiada en supabase/functions/save-link/link.ts,
 * que también usa record-price: si se cambia aquí, allí también. */
export function urlKey(raw) {
  let u
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  const amazon = amazonProduct(u)
  if (amazon) u = new URL(amazon)
  const host = u.hostname.toLowerCase().replace(/^www\./, '')
  const path = u.pathname.replace(/\/+$/, '').toLowerCase()
  const params = [...u.searchParams.entries()]
    .filter(([key]) => !IGNORED_PREFIXES.some((p) => key.toLowerCase().startsWith(p)))
    .sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
  return `${host}${path}${params ? `?${params}` : ''}`
}

/** El primer artículo de `items` que sea el mismo que alguna de `urls`. */
export function findSameItem(items, urls) {
  const keys = new Set(urls.map(urlKey).filter(Boolean))
  return items.find((item) => keys.has(urlKey(item.itm_url))) ?? null
}
