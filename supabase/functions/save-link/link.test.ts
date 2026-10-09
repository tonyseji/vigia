import { describe, it, expect } from 'vitest'
import { duplicateMessage, findSameItem, findUrl, hashKey, parseKey, savedMessage, urlKey } from './link.ts'
import { urlKey as webUrlKey } from '../../../src/lib/urlKey.js'
import { hashShortcutKey, newShortcutKey } from '../../../src/lib/shortcutKey.js'

// Mismo criterio que record-price/record.test.ts: link.ts no usa nada de Deno.

describe('findUrl', () => {
  it('acepta la URL de Safari y la saca de una frase', () => {
    expect(findUrl('https://www.ikea.com/es/es/p/kivik-sofa-123/')).toBe('https://www.ikea.com/es/es/p/kivik-sofa-123/')
    expect(findUrl('Mira esto: https://tienda.test/mesa?id=4.')).toBe('https://tienda.test/mesa?id=4')
  })

  it('rechaza lo que no lleva una dirección web', () => {
    expect(findUrl('sin enlace')).toBeNull()
    expect(findUrl('javascript:alert(1)')).toBeNull()
    expect(findUrl(undefined)).toBeNull()
    expect(findUrl({ url: 'https://x.test' })).toBeNull()
  })
})

describe('clave del atajo', () => {
  it('solo acepta el formato que crea Ajustes', () => {
    const key = newShortcutKey()
    expect(parseKey(key)).toBe(key)
    expect(parseKey(` ${key}\n`)).toBe(key)
    expect(parseKey('pega-tu-clave')).toBeNull()
    expect(parseKey(null)).toBeNull()
  })

  it('cada clave es distinta', () => {
    expect(newShortcutKey()).not.toBe(newShortcutKey())
  })

  it('la web y la función calculan el mismo hash', async () => {
    const key = newShortcutKey()
    const hash = await hashKey(key)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(await hashShortcutKey(key)).toBe(hash)
  })
})

describe('findSameItem', () => {
  const mine = { itm_usr_id: 'yo', itm_url: 'https://www.tienda.test/mesa/', itm_title: 'Mesa' }
  const shared = { itm_usr_id: 'otra', itm_url: 'https://tienda.test/mesa', itm_title: 'Mesa (compartida)' }

  it('la copia de urlKey da lo mismo que la de la web', () => {
    const url = 'http://WWW.Tienda.test/Mesa/?utm_source=x&b=2&a=1#foto'
    expect(urlKey(url)).toBe(webUrlKey(url))
    const amazon = 'https://www.amazon.es/Soweiz-mesa/dp/B0GWHLD5NG/ref=sr_1_15?th=1'
    expect(urlKey(amazon)).toBe(webUrlKey(amazon))
    expect(urlKey(amazon)).toBe(urlKey('https://amazon.es/dp/B0GWHLD5NG'))
  })

  it('encuentra el mismo artículo aunque no se escriba igual, y prefiere el propio', () => {
    expect(findSameItem([shared, mine], 'yo', 'https://tienda.test/mesa?utm_campaign=x')).toBe(mine)
    expect(findSameItem([shared], 'yo', 'https://tienda.test/mesa')).toBe(shared)
    expect(findSameItem([mine], 'yo', 'https://tienda.test/silla')).toBeNull()
  })
})

describe('mensajes', () => {
  it('con precio, sin precio y en modo manual', () => {
    // Intl pone un espacio duro antes del €.
    expect(savedMessage({ url: 'https://tienda.test/m', title: 'Mesa', price: 1234.5, manual: false })).toMatch(
      /^Guardado en Vigía: Mesa · 1234,50\s€$/,
    )
    expect(savedMessage({ url: 'https://tienda.test/m', title: 'https://tienda.test/m', price: null, manual: false })).toBe(
      'Guardado en Vigía: tienda.test',
    )
    expect(savedMessage({ url: 'https://www.maisonsdumonde.com/p', title: null, price: null, manual: true })).toMatch(
      /^Guardado en Vigía sin precio: maisonsdumonde\.com/,
    )
  })

  it('duplicado', () => {
    expect(duplicateMessage({ itm_usr_id: 'yo', itm_url: 'https://tienda.test/m', itm_title: 'Mesa' })).toBe(
      'Ya lo tenías en Vigía: Mesa',
    )
  })
})
