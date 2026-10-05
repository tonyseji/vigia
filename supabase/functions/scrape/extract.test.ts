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

  // Vinted dejo de publicar JSON-LD en octubre de 2026 (B26): el precio solo
  // va en los datos de React, dentro de un string con las comillas escapadas.
  const vinted = (objects: string) => String.raw`<html><head>
    <meta property="og:title" content="Lámpara IKEA tomelilla en perfecto estado | Vinted">
    <meta property="og:image" content="https://images1.vinted.net/t/foto.webp">
    </head><body><p>10,00 €</p><script>self.__next_f.push([1,"e3:[\"$\",\"$Le4\",null,{\"value\":${objects}}]\n"])</script></body></html>`
  const item = (id: string, amount: string) =>
    String.raw`{\"id\":\"${id}\",\"seller_id\":\"33660104\",\"business\":false,\"buyerReservation\":null,\"sellerReservation\":null,\"price\":{\"amount\":\"${amount}\",\"currency_code\":\"EUR\"},\"title\":\"Lámpara\"}`
  const url = 'https://www.vinted.es/items/10247399138-lampara-ikea-tomelilla-en-perfecto-estado'

  it('Vinted: lee el precio del artículo de la URL en los datos de React', () => {
    const r = extractFromHtml(vinted(item('10247399138', '10')), url)
    expect(r.price).toBe(10)
    expect(r.currency).toBe('EUR')
    expect(r.source).toBe('vinted')
    expect(r.title).toBe('Lámpara IKEA tomelilla en perfecto estado | Vinted')
  })

  it('Vinted: precio con decimales', () => {
    expect(extractFromHtml(vinted(item('10247399138', '12.5')), url).price).toBe(12.5)
  })

  it('Vinted: nunca coge el precio de otro artículo de la página', () => {
    expect(extractFromHtml(vinted(item('999', '50')), url).price).toBeUndefined()
    const both = `[${item('999', '50')},${item('10247399138', '10')}]`
    expect(extractFromHtml(vinted(both), url).price).toBe(10)
  })

  // Al venderse, Vinted deja la ficha pero quita el JSON-LD y los botones de
  // compra, y pone en el lateral el aviso «Vendido» (buyer_item_status).
  const status = (id: string) =>
    String.raw`{\"data\":{\"item_id\":\"${id}\",\"seller_id\":\"33660104\",\"theme\":\"SUCCESS\",\"title\":\"Vendido\"},\"exposures\":[],\"name\":\"buyer_item_status\",\"section\":\"sidebar\",\"type\":\"buyer_item_status\"}`

  it('Vinted: un artículo vendido tiene precio pero no stock', () => {
    const r = extractFromHtml(vinted(`[${item('10247399138', '10')},${status('10247399138')}]`), url)
    expect(r.price).toBe(10)
    expect(r.inStock).toBe(false)
  })

  it('Vinted: el aviso de estado de otro artículo no cuenta', () => {
    const r = extractFromHtml(vinted(`[${item('10247399138', '10')},${status('999')}]`), url)
    expect(r.inStock).toBeUndefined()
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
  it('detecta el captcha de Shein aunque venga lejos del principio', () => {
    const html = '<html><head><title>Ropa de Mujer y Hombre | SHEIN</title></head><body>' + 'x'.repeat(130000) +
      '"originalUrl":"/risk/challenge?captcha_type=909&redirection=https%3A%2F%2Fes.shein.com%2F"</body></html>'
    expect(isBotPage('https://es.shein.com/vestido-p-123.html', html)).toBe(true)
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
