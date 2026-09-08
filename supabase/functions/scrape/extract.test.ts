import { describe, it, expect } from 'vitest'
import { parsePrice, extractFromHtml, isBotPage } from './extract.ts'

// extract.ts no usa ninguna API especifica de Deno mas alla de
// fetch/URL/AbortController globales, ya estandar tambien en Vitest/Node.
// Se testea aqui con el runner ya existente en el repo en vez de con
// Deno.test porque este entorno no tiene el CLI de Deno instalado.

describe('parsePrice', () => {
  it('formato europeo con miles y decimales', () => {
    expect(parsePrice('1.299,00 €')).toBe(1299)
  })
  it('formato americano con miles y decimales', () => {
    expect(parsePrice('1,299.00')).toBe(1299)
  })
  it('entero sin separadores', () => {
    expect(parsePrice('649')).toBe(649)
  })
  it('espacio como separador de miles, coma decimal', () => {
    expect(parsePrice('1 299,95')).toBe(1299.95)
  })
  it('coma como decimal sin miles', () => {
    expect(parsePrice('649,50')).toBe(649.5)
  })
  it('punto como decimal sin miles', () => {
    expect(parsePrice('649.50')).toBe(649.5)
  })
  it('numero ya numerico', () => {
    expect(parsePrice(429)).toBe(429)
  })
  it('rechaza cero, negativos y vacio', () => {
    expect(parsePrice(0)).toBeUndefined()
    expect(parsePrice(-10)).toBeUndefined()
    expect(parsePrice('')).toBeUndefined()
    expect(parsePrice(null)).toBeUndefined()
    expect(parsePrice(undefined)).toBeUndefined()
  })
})

describe('extractFromHtml', () => {
  it('lee precio, titulo e imagen de JSON-LD Product', () => {
    const html = `<html><head>
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Product","name":"Sofa Noa 3 plazas",
         "image":"https://tienda.example/sofa.jpg",
         "offers":{"@type":"Offer","price":"459.00","priceCurrency":"EUR","availability":"https://schema.org/InStock"}}
      </script>
      </head><body></body></html>`
    const r = extractFromHtml(html, 'https://tienda.example/producto')
    expect(r.title).toBe('Sofa Noa 3 plazas')
    expect(r.price).toBe(459)
    expect(r.currency).toBe('EUR')
    expect(r.inStock).toBe(true)
    expect(r.image).toBe('https://tienda.example/sofa.jpg')
    expect(r.source).toBe('json-ld')
  })

  it('cae a Open Graph cuando no hay JSON-LD', () => {
    const html = `<html><head>
      <meta property="og:title" content="Mesa de centro roble">
      <meta property="og:image" content="https://tienda.example/mesa.jpg">
      <meta property="product:price:amount" content="129.90">
      <meta property="product:price:currency" content="EUR">
      </head><body></body></html>`
    const r = extractFromHtml(html, 'https://tienda.example/producto')
    expect(r.title).toBe('Mesa de centro roble')
    expect(r.price).toBe(129.9)
    expect(r.currency).toBe('EUR')
    expect(r.source).toBe('meta')
  })

  it('sin JSON-LD ni Open Graph ni precio, usa el titulo de la pagina', () => {
    const html = `<html><head><title>Producto sin datos estructurados</title></head><body></body></html>`
    const r = extractFromHtml(html, 'https://tienda.example/producto')
    expect(r.title).toBe('Producto sin datos estructurados')
    expect(r.price).toBeUndefined()
  })
})

describe('isBotPage', () => {
  it('detecta el checkpoint de Vercel', () => {
    const html = '<html><body><h1>Vercel Security Checkpoint</h1></body></html>'
    expect(isBotPage('https://maisonsdumonde.com/producto', html)).toBe(true)
  })
  it('detecta un interstitial generico de Cloudflare', () => {
    const html = '<html><body>Just a moment... cf-browser-verification</body></html>'
    expect(isBotPage('https://tienda.example/producto', html)).toBe(true)
  })
  it('no marca como bot una pagina de producto normal', () => {
    const html = '<html><body><h1>Sofa Noa</h1><p>459 €</p></body></html>'
    expect(isBotPage('https://tienda.example/producto', html)).toBe(false)
  })
  it('amazon sin productTitle se trata como interstitial', () => {
    const html = '<html><body>Continuar comprando</body></html>'
    expect(isBotPage('https://amazon.es/dp/B0X', html)).toBe(true)
  })
  it('amazon con productTitle es pagina real', () => {
    const html = '<html><body><span id="productTitle">Sofa Noa</span></body></html>'
    expect(isBotPage('https://amazon.es/dp/B0X', html)).toBe(false)
  })
})
