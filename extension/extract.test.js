import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { readOpenPage } from './extract.js'

// readOpenPage se ejecuta dentro de la pestaña, después de parse.js. Aquí se
// carga el parse.js de verdad (el que inyecta la extensión) y se le da un
// `document` y un `location` mínimos. Los casos de tiendas están en
// supabase/functions/scrape/parse.test.ts: es el mismo lector.
function load(html, href, canonical = null) {
  globalThis.VigiaParse = new Function(`${readFileSync(new URL('./parse.js', import.meta.url), 'utf8')}; return VigiaParse`)()
  globalThis.location = { href }
  globalThis.document = {
    documentElement: { outerHTML: html },
    querySelector: (sel) => (sel === 'link[rel="canonical"]' && canonical ? { href: canonical } : null),
  }
}

afterEach(() => {
  delete globalThis.document
  delete globalThis.location
  delete globalThis.VigiaParse
})

describe('readOpenPage (extensión)', () => {
  it('le pasa la página y su canónica al lector compartido', () => {
    const product = { '@type': 'product', name: 'Ratón', offers: { '@type': 'AggregateOffer', lowPrice: '74.99', offers: { price: '74.99', availability: 'https://schema.org/InStock' } } }
    load(`<html><head><script type="application/ld+json">${JSON.stringify(product)}</script></head></html>`, 'https://www.pccomponentes.com/raton?ref=x', 'https://www.pccomponentes.com/raton')
    expect(readOpenPage()).toEqual({
      blocked: false,
      url: 'https://www.pccomponentes.com/raton',
      altUrl: 'https://www.pccomponentes.com/raton?ref=x',
      title: 'Ratón',
      image: null,
      price: 74.99,
      currency: 'EUR',
      inStock: true,
    })
  })

  it('una página de bloqueo devuelve blocked', () => {
    load('<html><head><title>Just a moment...</title></head></html>', 'https://tienda.test/p/1')
    expect(readOpenPage()).toEqual({ blocked: true })
  })
})
