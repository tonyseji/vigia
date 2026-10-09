// Lee el producto de la página abierta. Se inyecta en la pestaña con
// chrome.scripting.executeScript({ func: extractProduct }): tiene que ser
// autocontenida, sin nada de fuera de la función.
//
// Misma lógica que el botón de la barra de marcadores
// (src/lib/browserImport.js): JSON-LD y, si no hay, metas de Open Graph.
// Si cambia una, cambiar la otra.
export function extractProduct() {
  const head = document.documentElement.outerHTML.slice(0, 5000)
  if (/captcha-delivery\.com|Please enable JS and disable any ad blocker|Just a moment\.\.\.|Vercel Security Checkpoint/i.test(head)) {
    return { blocked: true }
  }

  function findProduct(node) {
    if (!node || typeof node !== 'object') return null
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = findProduct(child)
        if (found) return found
      }
      return null
    }
    const type = node['@type']
    if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) return node
    return findProduct(node['@graph'])
  }
  function meta(key) {
    const el = document.querySelector(`meta[property="${key}"],meta[name="${key}"],meta[itemprop="${key}"]`)
    return el ? el.getAttribute('content') : null
  }
  function toNumber(raw) {
    if (raw == null) return NaN
    if (typeof raw === 'number') return raw
    let s = String(raw).trim()
    if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
    return Number(s.replace(/[^\d.]/g, ''))
  }

  // Amazon no publica JSON-LD: se lee de la ficha, como domainSpecific en
  // scrape/extract.ts. El a-offscreen del precio puede venir vacío; entonces
  // vale a-price-whole + a-price-fraction.
  if (/(^|\.)amazon\.[a-z.]+$/i.test(new URL(location.href).hostname)) {
    // Su captcha («Introduce los caracteres que ves») no lleva ficha.
    if (document.querySelector('form[action*="validateCaptcha"]')) return { blocked: true }
    let raw = null
    for (const sel of ['#corePriceDisplay_desktop_feature_div', '#corePrice_feature_div', '#apex_desktop', '#corePriceDisplay_mobile_feature_div']) {
      const zone = document.querySelector(sel)
      if (!zone) continue
      const offscreen = [...zone.querySelectorAll('.a-price .a-offscreen')].map((el) => el.textContent.trim()).find((t) => /\d/.test(t))
      const whole = zone.querySelector('.a-price-whole')
      const fraction = zone.querySelector('.a-price-fraction')
      if (offscreen) raw = offscreen
      else if (whole) raw = `${whole.textContent.replace(/[^\d.]/g, '')},${fraction ? fraction.textContent.trim() : '00'}`
      if (raw) break
    }
    const amazonPrice = toNumber(raw && raw.replace(/[^\d.,]/g, ''))
    if (!Number.isFinite(amazonPrice)) return { blocked: false, price: null }
    const title = document.querySelector('#productTitle')
    const image = document.querySelector('#landingImage')
    const availability = document.querySelector('#availability')
    const stockText = availability ? availability.textContent : ''
    const canonical = document.querySelector('link[rel="canonical"]')
    return {
      blocked: false,
      url: (canonical && canonical.href) || location.href,
      altUrl: location.href,
      title: (title && title.textContent.trim()) || meta('og:title') || document.title,
      image: (image && (image.getAttribute('data-old-hires') || image.getAttribute('src'))) || meta('og:image') || null,
      price: amazonPrice,
      currency: 'EUR',
      inStock: /no disponible|agotado|unavailable/i.test(stockText) ? false : /en stock|disponible|in stock|env[ií]o en/i.test(stockText) ? true : null,
    }
  }

  let product = null
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      product = findProduct(JSON.parse(script.textContent))
    } catch {
      // JSON-LD roto: se prueba el siguiente.
    }
    if (product) break
  }
  let offer = product && product.offers
  if (Array.isArray(offer)) offer = offer[0]
  let rawPrice = offer ? (offer.price != null ? offer.price : offer.lowPrice) : null
  if (rawPrice == null) rawPrice = meta('product:price:amount') || meta('og:price:amount') || meta('price')
  const price = toNumber(rawPrice)
  if (!Number.isFinite(price)) return { blocked: false, price: null }

  let image = product && product.image
  if (Array.isArray(image)) image = image[0]
  if (image && typeof image === 'object') image = image.url || image.contentUrl
  const availability = String((offer && offer.availability) || '')
  const canonical = document.querySelector('link[rel="canonical"]')
  return {
    blocked: false,
    url: (canonical && canonical.href) || location.href,
    altUrl: location.href,
    title: (product && product.name) || meta('og:title') || document.title,
    image: image || meta('og:image') || null,
    price,
    currency: (offer && offer.priceCurrency) || meta('product:price:currency') || meta('og:price:currency') || 'EUR',
    // Mismo criterio que scrape/extract.ts: BackOrder se puede pedir.
    inStock: /OutOfStock|SoldOut|Discontinued/i.test(availability)
      ? false
      : /InStock|LimitedAvailability|PreOrder|PreSale|BackOrder|MadeToOrder|OnlineOnly/i.test(availability)
        ? true
        : null,
  }
}
