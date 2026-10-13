import { describe, it, expect } from 'vitest'
import { readPage } from './parse.ts'

// readPage es lo que la extensión y el botón de marcadores le pasan a la
// página abierta (su outerHTML). Antes tenían su propio lector; estos casos
// vienen de sus tests (sesiones 36, 37 y 39).

function page(jsonLd: unknown[], extraHead = '') {
  const scripts = jsonLd.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('')
  return `<html><head><title>Página</title>${extraHead}${scripts}</head><body></body></html>`
}

describe('readPage', () => {
  it('lee una ficha con JSON-LD', () => {
    const html = page([{ '@type': 'Product', name: 'Mesita Jill', image: ['https://t.test/a.jpg'], offers: [{ price: 55.9, priceCurrency: 'EUR', availability: 'https://schema.org/InStock' }] }])
    expect(readPage(html, 'https://tienda.test/p/1', 'https://tienda.test/p/jill')).toEqual({
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

  it('sin canónica guarda la dirección de la barra', () => {
    const html = page([{ '@type': 'Product', name: 'Silla', offers: { price: 10 } }])
    expect(readPage(html, 'https://tienda.test/p/1')).toMatchObject({ url: 'https://tienda.test/p/1', inStock: null })
  })

  it('BackOrder (Sklum, entrega más tarde) cuenta como en stock', () => {
    const html = page([{ '@type': 'Product', name: 'Mesita', offers: { price: 94.95, availability: 'https://schema.org/BackOrder' } }])
    expect(readPage(html, 'https://tienda.test/p/1')).toMatchObject({ inStock: true })
  })

  it('PcComponentes: «product» en minúscula y AggregateOffer con la oferta dentro', () => {
    const html = page([
      { '@type': 'BreadcrumbList' },
      {
        '@type': 'product',
        name: 'Ratón Logitech Pro X Superlight 2 SE',
        image: ['https://img.pccomponentes.com/a.jpg'],
        offers: {
          '@type': 'AggregateOffer',
          highPrice: '123.17',
          lowPrice: '74.99',
          offerCount: '5',
          priceCurrency: 'EUR',
          offers: { '@type': 'Offer', availability: 'https://schema.org/InStock', priceCurrency: 'EUR', price: '74.99' },
        },
      },
    ])
    expect(readPage(html, 'https://www.pccomponentes.com/raton')).toMatchObject({ title: 'Ratón Logitech Pro X Superlight 2 SE', image: 'https://img.pccomponentes.com/a.jpg', price: 74.99, currency: 'EUR', inStock: true })
  })

  it('si la dirección elige variante, guarda la de la variante y no la canónica', () => {
    const base = 'https://www.sklum.com/es/comprar-bases-para-lamparas/219212-orlena.html'
    const html = page([{ '@type': 'Product', name: 'Orlena', url: base, offers: [
      { price: '20.95', availability: 'https://schema.org/BackOrder', url: `${base}?id_c=617589` },
      { price: '32.95', availability: 'https://schema.org/BackOrder', url: `${base}?id_c=617585` },
    ] }])
    expect(readPage(html, `${base}?id_c=617585&utm_source=x`, base)).toMatchObject({ url: `${base}?id_c=617585`, price: 32.95 })
    expect(readPage(html, base, base)).toMatchObject({ url: base, price: 20.95 })
  })

  it('reconoce la página de DataDome', () => {
    const html = '<html><head><script src="https://ct.captcha-delivery.com/i.js"></script></head></html>'
    expect(readPage(html, 'https://www.maisonsdumonde.com/p/1')).toEqual({ blocked: true })
  })

  it('sin precio devuelve price null', () => {
    expect(readPage(page([{ '@type': 'WebPage' }]), 'https://tienda.test/')).toEqual({ blocked: false, price: null })
  })
})

// Amazon no publica JSON-LD: precio, título, foto y stock del HTML (sesión
// 37). El a-offscreen del precio puede venir vacío; entonces vale
// a-price-whole + a-price-fraction.
describe('readPage en Amazon', () => {
  const HREF = 'https://www.amazon.es/Soweiz-mesa/dp/B0GWHLD5NG/ref=sr_1_15?th=1'
  const CANONICAL = 'https://www.amazon.es/Soweiz-mesa/dp/B0GWHLD5NG'
  function amazon({ offscreen = ' ', whole = '185', fraction = '00', availability = ' En stock ' } = {}) {
    return `<html><head><title>Amazon.es</title></head><body>
<span id="productTitle" class="a-size-large">  Soweiz - Mesa de centro elevable  </span>
<div id="corePriceDisplay_desktop_feature_div"><span class="a-price"><span class="a-offscreen">${offscreen}</span><span aria-hidden="true"><span class="a-price-whole">${whole}<span class="a-price-decimal">,</span></span><span class="a-price-fraction">${fraction}</span><span class="a-price-symbol">€</span></span></span></div>
<div id="availability"><span class="a-size-medium a-color-success">${availability}</span></div>
<img id="landingImage" data-old-hires="https://m.media-amazon.com/images/I/919a.jpg" src="https://m.media-amazon.com/small.jpg">
</body></html>`
  }

  it('lee la ficha con el a-offscreen vacío', () => {
    expect(readPage(amazon(), HREF, CANONICAL)).toEqual({
      blocked: false,
      url: CANONICAL,
      altUrl: HREF,
      title: 'Soweiz - Mesa de centro elevable',
      image: 'https://m.media-amazon.com/images/I/919a.jpg',
      price: 185,
      currency: 'EUR',
      inStock: true,
    })
  })
  it('con a-offscreen y símbolo de euro', () => {
    expect(readPage(amazon({ offscreen: '1.299,95 €' }), HREF)).toMatchObject({ price: 1299.95 })
  })
  it('miles con a-price-whole', () => {
    expect(readPage(amazon({ whole: '1.299', fraction: '95' }), HREF)).toMatchObject({ price: 1299.95 })
  })
  it('«Envío en 4 a 5 días» es en stock', () => {
    expect(readPage(amazon({ availability: ' Envío en 4 a 5 días ' }), HREF)).toMatchObject({ inStock: true })
  })
  it('«No disponible» es sin stock', () => {
    expect(readPage(amazon({ availability: 'No disponible por el momento.' }), HREF)).toMatchObject({ inStock: false })
  })
  it('el captcha de Amazon cuenta como bloqueo', () => {
    const html = '<html><body><form method="get" action="/errors/validateCaptcha"><input name="field-keywords"></form></body></html>'
    expect(readPage(html, HREF)).toEqual({ blocked: true })
  })
  it('una página de Amazon que no es ficha no es un bloqueo', () => {
    expect(readPage('<html><body><div id="nav-search"></div></body></html>', 'https://www.amazon.es/')).toEqual({ blocked: false, price: null })
  })
})
