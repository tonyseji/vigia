/** Textos de un artículo para enseñar en la lista.
 *
 * Un artículo guardado sin leer la ficha (tienda bloqueada, docs/TIENDAS.md)
 * lleva la dirección como título: es la señal de «aún sin nombre» con la que
 * la extensión y el botón del navegador saben que pueden ponerle el real
 * (useItems.saveFromBrowser, record-price). Por eso el nombre sacado de la
 * dirección es solo para mostrar y nunca se guarda. */

// Piezas de la dirección que son referencias, no palabras: «31864327»,
// «M21044867», «p» (Shein: …-p-31864327.html).
const ID_TOKEN = /^(?:\d+|[a-z]{0,2}\d{4,}[a-z\d]*|p)$/i
const HAS_WORD = /\p{L}{2,}/u

function hostOf(url) {
  return url.hostname.replace(/^www\./, '')
}

/** «Lampara de mesa LED» a partir de …/Lampara-de-mesa-LED-p-31864327.html.
 * Si la dirección no lleva un nombre reconocible, el dominio de la tienda. */
export function titleFromUrl(raw) {
  let url
  try {
    url = new URL(raw)
  } catch {
    return raw
  }
  const segments = url.pathname.split('/').filter(Boolean).reverse()
  for (const segment of segments) {
    let text
    try {
      text = decodeURIComponent(segment)
    } catch {
      text = segment
    }
    const words = text
      .replace(/\.(?:html?|php|aspx?)$/i, '')
      .split(/[-_+\s]+/)
      .filter((word) => word && !ID_TOKEN.test(word))
    if (words.filter((word) => HAS_WORD.test(word)).length >= 2) {
      const title = words.join(' ')
      return title.charAt(0).toUpperCase() + title.slice(1)
    }
  }
  return hostOf(url)
}

/** El nombre que se enseña: el guardado, o el sacado de la dirección si
 * todavía no tiene (ver arriba). */
export function displayTitle(item) {
  if (item.itm_title && item.itm_title !== item.itm_url) return item.itm_title
  return titleFromUrl(item.itm_url)
}

/** Para buscar sin que importen tildes ni mayúsculas: «lampara» encuentra
 * «Lámpara». */
export function normalizeSearch(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}
