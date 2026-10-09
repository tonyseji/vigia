import { describe, it, expect, afterEach } from 'vitest'
import { extractProduct } from './extract.js'

// extractProduct se ejecuta dentro de la pestaña: aquí se le da un
// `document` y un `location` mínimos, con solo lo que usa.
function page({ html = '<html><head></head>', jsonLd = [], metas = {}, canonical = null }) {
  globalThis.location = { href: 'https://tienda.test/p/1' }
  globalThis.document = {
    title: 'Página',
    documentElement: { outerHTML: html },
    querySelectorAll: () => jsonLd.map((j) => ({ textContent: JSON.stringify(j) })),
    querySelector: (sel) => {
      if (sel === 'link[rel="canonical"]') return canonical ? { href: canonical } : null
      const key = /meta\[property="([^"]+)"/.exec(sel)?.[1]
      return key in metas ? { getAttribute: () => metas[key] } : null
    },
  }
}

afterEach(() => {
  delete globalThis.document
  delete globalThis.location
})

describe('extractProduct (extensión)', () => {
  it('lee una ficha con JSON-LD', () => {
    page({
      jsonLd: [{ '@type': 'Product', name: 'Mesita Jill', image: ['https://t.test/a.jpg'], offers: [{ price: 55.9, priceCurrency: 'EUR', availability: 'https://schema.org/InStock' }] }],
      canonical: 'https://tienda.test/p/jill',
    })
    expect(extractProduct()).toEqual({
      blocked: false,
      url: 'https://tienda.test/p/jill',
      altUrl: 'https://tienda.test/p/1',
      title: 'Mesita Jill',
      image: 'https://t.test/a.jpg',
      price: 55.9,
      currency: 'EUR',
      inStock: true,
    })
  })

  it('BackOrder (Sklum, entrega más tarde) cuenta como en stock', () => {
    page({ jsonLd: [{ '@type': 'Product', name: 'Mesita', offers: { price: 94.95, availability: 'https://schema.org/BackOrder' } }] })
    expect(extractProduct().inStock).toBe(true)
  })

  it('reconoce la página de DataDome', () => {
    page({ html: '<html><script src="https://ct.captcha-delivery.com/i.js"></script>' })
    expect(extractProduct()).toEqual({ blocked: true })
  })

  it('sin precio devuelve price null', () => {
    page({ jsonLd: [{ '@type': 'WebPage' }] })
    expect(extractProduct()).toEqual({ blocked: false, price: null })
  })
})

// Amazon no publica JSON-LD: precio, título, foto y stock del HTML (sesión
// 37). El a-offscreen del precio puede venir vacío; entonces vale
// a-price-whole + a-price-fraction.
describe('extractProduct en Amazon', () => {
  function el(text, attrs = {}) {
    return { textContent: text, getAttribute: (k) => attrs[k] ?? null }
  }
  function amazon({ offscreen = ' ', whole = '185,', fraction = '00', availability = ' En stock ' } = {}) {
    globalThis.location = { href: 'https://www.amazon.es/Soweiz-mesa/dp/B0GWHLD5NG/ref=sr_1_15?th=1' }
    const zone = {
      querySelectorAll: (sel) => (sel.includes('a-offscreen') ? [el(offscreen)] : []),
      querySelector: (sel) => (sel === '.a-price-whole' ? el(whole) : sel === '.a-price-fraction' ? el(fraction) : null),
    }
    const nodes = {
      '#corePriceDisplay_desktop_feature_div': zone,
      '#productTitle': el('  Soweiz - Mesa de centro elevable  '),
      '#landingImage': el('', { 'data-old-hires': 'https://m.media-amazon.com/images/I/919a.jpg', src: 'https://m.media-amazon.com/small.jpg' }),
      '#availability': el(availability),
      'link[rel="canonical"]': { href: 'https://www.amazon.es/Soweiz-mesa/dp/B0GWHLD5NG' },
    }
    globalThis.document = {
      title: 'Amazon.es',
      documentElement: { outerHTML: '<html>' },
      querySelectorAll: () => [],
      querySelector: (sel) => nodes[sel] ?? null,
    }
  }

  it('lee la ficha con el a-offscreen vacío', () => {
    amazon()
    expect(extractProduct()).toEqual({
      blocked: false,
      url: 'https://www.amazon.es/Soweiz-mesa/dp/B0GWHLD5NG',
      altUrl: 'https://www.amazon.es/Soweiz-mesa/dp/B0GWHLD5NG/ref=sr_1_15?th=1',
      title: 'Soweiz - Mesa de centro elevable',
      image: 'https://m.media-amazon.com/images/I/919a.jpg',
      price: 185,
      currency: 'EUR',
      inStock: true,
    })
  })
  it('con a-offscreen y símbolo de euro', () => {
    amazon({ offscreen: '1.299,95 €' })
    expect(extractProduct().price).toBe(1299.95)
  })
  it('miles con a-price-whole', () => {
    amazon({ whole: '1.299,', fraction: '95' })
    expect(extractProduct().price).toBe(1299.95)
  })
  it('«Envío en 4 a 5 días» es en stock', () => {
    amazon({ availability: ' Envío en 4 a 5 días ' })
    expect(extractProduct().inStock).toBe(true)
  })
  it('el captcha de Amazon cuenta como bloqueo', () => {
    amazon()
    const plain = globalThis.document.querySelector
    globalThis.document.querySelector = (sel) => (sel === 'form[action*="validateCaptcha"]' ? {} : plain(sel))
    expect(extractProduct()).toEqual({ blocked: true })
  })
  it('«No disponible» es sin stock', () => {
    amazon({ availability: 'No disponible por el momento.' })
    expect(extractProduct().inStock).toBe(false)
  })
})
