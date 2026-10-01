/** Botón «Guardar en Vigía» para la barra de marcadores (backlog B21).
 *
 * Para tiendas que bloquean la lectura desde el servidor (DataDome en
 * Maisons du Monde, ver docs/TIENDAS.md): el navegador del usuario ya tiene
 * la ficha abierta, así que el botón lee de ahí título, imagen y precio y
 * abre Vigía con esos datos en el `#importar=` de la URL. El hash no llega a
 * ningún servidor.
 *
 * El botón lleva una clave aleatoria que Vigía guarda en este navegador al
 * crearlo (Ajustes). Si la clave coincide, se guarda sin preguntar; si no
 * (un enlace hecho a mano por otra persona, otro navegador, un botón viejo),
 * Vigía pide confirmación antes de guardar nada.
 */

/** Nombre con el que queda en la barra de marcadores. Chrome no deja poner
 * icono propio a un marcador `javascript:`: el ojo del logo va como emoji. */
export const BOOKMARK_TITLE = '👁️ Guardar en Vigía'

/** Explicación de la etiqueta «sin precio automático» (ItemRow, ItemTile). */
export const MANUAL_HINT =
  'Esta tienda no deja leer el precio desde Vigía: no se actualiza solo. Para apuntar el de hoy, pulsa «Guardar en Vigía» en su ficha o edítalo a mano.'

const HASH_KEY = 'importar'
const STORAGE_KEY = 'vigia.pendingImport'
const KEY_STORAGE_KEY = 'vigia.bookmarkletKey'
const KEY_RE = /^[0-9a-f]{32}$/

// Corre en la página de la tienda, no en Vigía: autocontenido, sin nada del
// bundle. Mismo orden que el extractor del servidor (JSON-LD, luego metas).
// `__ORIGEN__` y `__CLAVE__` se sustituyen al construir el enlace.
const BOOKMARKLET_SOURCE = `
(function () {
  function findProduct(node) {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) {
        var found = findProduct(node[i]);
        if (found) return found;
      }
      return null;
    }
    var type = node['@type'];
    if (type === 'Product' || (Array.isArray(type) && type.indexOf('Product') >= 0)) return node;
    return findProduct(node['@graph']);
  }
  function meta(key) {
    var el = document.querySelector('meta[property="' + key + '"],meta[name="' + key + '"],meta[itemprop="' + key + '"]');
    return el ? el.getAttribute('content') : null;
  }
  function toNumber(raw) {
    if (raw == null) return NaN;
    if (typeof raw === 'number') return raw;
    var s = String(raw).trim();
    if (/,\\d{1,2}$/.test(s)) s = s.replace(/\\./g, '').replace(',', '.');
    return Number(s.replace(/[^\\d.]/g, ''));
  }
  var product = null;
  var scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (var i = 0; i < scripts.length && !product; i++) {
    try { product = findProduct(JSON.parse(scripts[i].textContent)); } catch (e) {}
  }
  var offer = product && product.offers;
  if (Array.isArray(offer)) offer = offer[0];
  var rawPrice = offer ? (offer.price != null ? offer.price : offer.lowPrice) : null;
  if (rawPrice == null) rawPrice = meta('product:price:amount') || meta('og:price:amount') || meta('price');
  var price = toNumber(rawPrice);
  if (!isFinite(price)) {
    alert('Vigía: no encuentro el precio en esta página. Ábrelo desde la ficha de un producto.');
    return;
  }
  var image = product && product.image;
  if (Array.isArray(image)) image = image[0];
  if (image && typeof image === 'object') image = image.url || image.contentUrl;
  var availability = String((offer && offer.availability) || '');
  var canonical = document.querySelector('link[rel="canonical"]');
  var data = {
    u: (canonical && canonical.href) || location.href,
    t: (product && product.name) || meta('og:title') || document.title,
    i: image || meta('og:image') || null,
    p: price,
    c: (offer && offer.priceCurrency) || meta('product:price:currency') || meta('og:price:currency') || 'EUR',
    s: /InStock|LimitedAvailability|PreOrder/i.test(availability) ? true : /OutOfStock|SoldOut|Discontinued/i.test(availability) ? false : null,
    k: '__CLAVE__'
  };
  var encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data))))
    .replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
  window.open('__ORIGEN__/#${HASH_KEY}=' + encoded, '_blank');
})();
`

/** Código JavaScript del botón, sin el prefijo `javascript:` (para tests). */
export function bookmarkletSource(origin, key = '') {
  return BOOKMARKLET_SOURCE.replace('__ORIGEN__', origin).replace('__CLAVE__', KEY_RE.test(key) ? key : '')
}

/** Enlace para arrastrar a la barra de marcadores. */
export function buildBookmarklet(origin, key) {
  const compact = bookmarkletSource(origin, key)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
  return `javascript:${encodeURIComponent(compact)}`
}

function decodeBase64Url(text) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function httpUrl(value) {
  if (typeof value !== 'string' || value.length > 2000) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

/** Los datos vienen de una URL que cualquiera puede escribir: se valida
 * todo y se descarta lo que no encaje. Sin URL o sin precio no hay nada
 * que importar. */
export function parseImport(payload) {
  if (!payload || typeof payload !== 'object') return null
  const url = httpUrl(payload.u)
  const price = typeof payload.p === 'number' ? payload.p : NaN
  if (!url || !Number.isFinite(price) || price < 0 || price >= 10_000_000) return null
  const title = typeof payload.t === 'string' ? payload.t.trim().slice(0, 300) : ''
  const currency = typeof payload.c === 'string' && /^[A-Z]{3}$/.test(payload.c) ? payload.c : 'EUR'
  return {
    url,
    title: title || url,
    image: httpUrl(payload.i),
    price: Math.round(price * 100) / 100,
    currency,
    inStock: typeof payload.s === 'boolean' ? payload.s : null,
    key: typeof payload.k === 'string' && KEY_RE.test(payload.k) ? payload.k : null,
  }
}

/** Lee `#importar=...` del hash. null si no hay o no es válido. */
export function readImport(hash) {
  const match = /^#importar=([A-Za-z0-9_-]+)$/.exec(hash ?? '')
  if (!match) return null
  try {
    return parseImport(JSON.parse(decodeBase64Url(match[1])))
  } catch {
    return null
  }
}

/** La URL sin el hash de importar (el resto se conserva). */
export function removeImportHash(href) {
  const url = new URL(href)
  if (url.hash.startsWith(`#${HASH_KEY}=`)) url.hash = ''
  return url.toString()
}

function defaultStorage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Igual que el enlace de invitación (shareLink.js): si no hay sesión, los
 * datos esperan aquí a que se entre. Se guarda ya validado. */
export function savePendingImport(data, storage = defaultStorage()) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Sin almacenamiento (modo privado): solo funcionará si ya hay sesión.
  }
}

export function loadPendingImport(storage = defaultStorage()) {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    return parseImport({ u: data.url, t: data.title, i: data.image, p: data.price, c: data.currency, s: data.inStock, k: data.key })
  } catch {
    return null
  }
}

export function clearPendingImport(storage = defaultStorage()) {
  try {
    storage?.removeItem(STORAGE_KEY)
  } catch {
    // Nada que limpiar si el almacenamiento no está disponible.
  }
}

function randomKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Clave del botón en este navegador; la crea la primera vez. Sin
 * almacenamiento devuelve una que no se recuerda: el botón funcionará,
 * pero pidiendo confirmación. */
export function getOrCreateBookmarkletKey(storage = defaultStorage(), makeKey = randomKey) {
  try {
    const saved = storage?.getItem(KEY_STORAGE_KEY)
    if (saved && KEY_RE.test(saved)) return saved
    const key = makeKey()
    storage?.setItem(KEY_STORAGE_KEY, key)
    return key
  } catch {
    return makeKey()
  }
}

/** Viene de un botón creado en este navegador: se puede guardar sin preguntar. */
export function isTrustedImport(data, storage = defaultStorage()) {
  if (!data?.key) return false
  try {
    return storage?.getItem(KEY_STORAGE_KEY) === data.key
  } catch {
    return false
  }
}
