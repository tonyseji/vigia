import { describe, it, expect } from 'vitest'
import { cleanUrl, urlKey, findSameItem } from '../urlKey.js'

const PAPEL = 'https://papelespintadosdc.com/producto/papel-pintado-jaipur-488-3/'

describe('urlKey', () => {
  it('da la misma clave a variantes de escritura de la misma dirección', () => {
    const variants = [
      'https://papelespintadosdc.com/producto/papel-pintado-jaipur-488-3',
      'http://www.papelespintadosdc.com/producto/papel-pintado-jaipur-488-3/',
      'https://PapelesPintadosDC.com/producto/Papel-Pintado-Jaipur-488-3/#reviews',
      `${PAPEL}?utm_source=google&gad_source=1&gclid=abc`,
      `${PAPEL}?_gl=1*abc*_ga*MTQ&srsltid=xyz`,
    ]
    for (const v of variants) expect(urlKey(v)).toBe(urlKey(PAPEL))
  })

  it('respeta los parámetros que no son de seguimiento, sin importar el orden', () => {
    const base = 'https://www.sklum.com/es/mesa-kerhen.html'
    expect(urlKey(`${base}?id_c=1`)).not.toBe(urlKey(base))
    expect(urlKey(`${base}?id_c=1`)).not.toBe(urlKey(`${base}?id_c=2`))
    expect(urlKey(`${base}?a=1&b=2`)).toBe(urlKey(`${base}?b=2&a=1&utm_medium=x`))
  })

  it('no confunde productos distintos de la misma tienda', () => {
    expect(urlKey('https://www.ikea.com/es/es/p/lindbyn-espejo-dorado-60597959/')).not.toBe(
      urlKey('https://www.ikea.com/es/es/p/ikornnes-espejo-pie-fresno-30298396/'),
    )
  })

  it('devuelve null si no es una URL', () => {
    expect(urlKey('no es una url')).toBeNull()
  })
})

describe('cleanUrl', () => {
  it('quita hash y seguimiento pero conserva la forma de la dirección', () => {
    expect(cleanUrl(`${PAPEL}?utm_source=x&id=3#top`)).toBe(`${PAPEL}?id=3`)
  })
})

describe('findSameItem', () => {
  const items = [
    { itm_id: 'a', itm_url: 'https://www.ikea.com/es/es/p/lindbyn-espejo-dorado-60597959/' },
    { itm_id: 'b', itm_url: PAPEL },
  ]

  it('encuentra el guardado aunque la dirección pegada no sea idéntica', () => {
    expect(findSameItem(items, ['http://papelespintadosdc.com/producto/papel-pintado-jaipur-488-3?gad_source=1'])?.itm_id).toBe('b')
  })

  it('prueba con todas las direcciones (canónica y barra)', () => {
    expect(findSameItem(items, ['https://tienda.test/otra', 'https://ikea.com/es/es/p/lindbyn-espejo-dorado-60597959'])?.itm_id).toBe('a')
  })

  it('null si no está', () => {
    expect(findSameItem(items, ['https://tienda.test/nueva'])).toBeNull()
  })
})

// En Amazon el producto es el ASIN: la misma mesa llega como /dp/ASIN, con
// ?th=1 o con el nombre y todo el rastro del buscador (sesión 37, tres
// copias de la misma mesa).
describe('Amazon por ASIN', () => {
  const corta = 'https://www.amazon.es/dp/B0GWHLD5NG'
  const variante = 'https://www.amazon.es/dp/B0GWHLD5NG?th=1'
  const buscador = 'https://www.amazon.es/Soweiz-elevable-estante-extensible-multifuncional/dp/B0GWHLD5NG/ref=sr_1_15?dib=eyJ2&dib_tag=se&keywords=Soweiz&qid=1&sr=8-15&th=1'

  it('cleanUrl deja la ficha en /dp/ASIN', () => {
    expect(cleanUrl(variante)).toBe(corta)
    expect(cleanUrl(buscador)).toBe(corta)
    expect(cleanUrl('https://www.amazon.es/gp/product/B0GWHLD5NG?psc=1')).toBe(corta)
  })
  it('las tres direcciones son el mismo artículo', () => {
    expect(urlKey(variante)).toBe(urlKey(corta))
    expect(urlKey(buscador)).toBe(urlKey(corta))
  })
  it('otro ASIN (otro color) es otro artículo', () => {
    expect(urlKey('https://www.amazon.es/dp/B0GWHLD5NX')).not.toBe(urlKey(corta))
  })
  it('lo que no es una ficha de Amazon no cambia', () => {
    expect(cleanUrl('https://www.amazon.es/s?k=mesa')).toBe('https://www.amazon.es/s?k=mesa')
  })
})
