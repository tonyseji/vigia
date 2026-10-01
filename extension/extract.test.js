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
      title: 'Mesita Jill',
      image: 'https://t.test/a.jpg',
      price: 55.9,
      currency: 'EUR',
      inStock: true,
    })
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
