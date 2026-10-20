import { describe, it, expect } from 'vitest'
import {
  completedMessage,
  duplicateMessage,
  fillUpdate,
  findSameItem,
  findUrl,
  hashKey,
  missingParts,
  missingText,
  parseKey,
  parsePage,
  savedMessage,
  stillMissingMessage,
  urlKey,
} from './link.ts'
import * as webGaps from '../../../src/lib/itemGaps.js'
import { SHORTCUT_PAGE_SCRIPT } from '../../../src/lib/shortcutKey.js'
import { extractFromHtml } from '../scrape/parse.ts'
import { readFileSync } from 'node:fs'
import { urlKey as webUrlKey } from '../../../src/lib/urlKey.js'
import { hashShortcutKey, newShortcutKey } from '../../../src/lib/shortcutKey.js'

// Mismo criterio que record-price/record.test.ts: link.ts no usa nada de Deno.

describe('findUrl', () => {
  // Sesión 42: el enlace delante y la frase detrás; antes se pegaba al enlace
  // y la tienda contestaba 404.
  it('corta el enlace donde empieza el texto de detrás', () => {
    expect(findUrl('https://wallapop.com/item/mesa-123 ¡Mira esto en Wallapop!')).toBe('https://wallapop.com/item/mesa-123')
    expect(findUrl('https://wallapop.com/item/mesa-123' + String.fromCharCode(10) + 'Descarga Wallapop')).toBe('https://wallapop.com/item/mesa-123')
  })
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
    // Tienda que bloquea, pero el precio lo leyó Safari (sesión 44).
    expect(savedMessage({ url: 'https://www.maisonsdumonde.com/p', title: 'Cómoda', price: 307.42, manual: true })).toMatch(
      /^Guardado en Vigía: Cómoda · 307,42\s€$/,
    )
    expect(savedMessage({ url: 'https://wallapop.com/item/m-1', title: null, price: null, manual: false, unread: true })).toMatch(
      /^Guardado en Vigía sin precio: ahora no he podido leer la ficha de wallapop\.com\. Lo vuelvo a intentar/,
    )
  })

  it('duplicado', () => {
    expect(duplicateMessage({ itm_usr_id: 'yo', itm_url: 'https://tienda.test/m', itm_title: 'Mesa' })).toBe(
      'Ya lo tenías en Vigía: Mesa',
    )
  })
})

describe('artículo incompleto (copia de src/lib/itemGaps.js)', () => {
  const url = 'https://www.manomano.es/p/aparador-24847236'
  const cases = [
    { itm_url: url, itm_title: url, itm_image_url: null, itm_price: null, itm_notified_price: null },
    { itm_url: url, itm_title: url, itm_image_url: null, itm_price: 913, itm_notified_price: null },
    { itm_url: url, itm_title: 'Aparador', itm_image_url: 'https://img/a.jpg', itm_price: 913, itm_notified_price: 900 },
  ]
  const reads = [{ title: 'Aparador Tobias', image: 'https://img/t.jpg', price: 950, inStock: true }, { title: 'Aparador' }, {}]

  it('da lo mismo que la de la web', () => {
    for (const item of cases) {
      expect(missingParts(item)).toEqual(webGaps.missingParts(item))
      expect(missingText(missingParts(item))).toBe(webGaps.missingText(webGaps.missingParts(item)))
      for (const read of reads) expect(fillUpdate(item, read, 'ahora')).toEqual(webGaps.fillUpdate(item, read, 'ahora'))
    }
  })

  it('mensajes de completado y de seguir sin poder leerlo', () => {
    const item = { itm_usr_id: 'ella', ...cases[1] }
    expect(stillMissingMessage(item, 'HTTP 403 (la tienda bloquea la lectura automática)')).toBe(
      'Ya lo tenías en Vigía: manomano.es. Le falta la foto y el nombre, pero ahora tampoco he podido leerlo: HTTP 403 (la tienda bloquea la lectura automática)',
    )
    expect(completedMessage({ itm_url: url, itm_title: 'Aparador Tobias', itm_price: 950 })).toMatch(
      /^Completado en Vigía: Aparador Tobias · 950,00\s€$/,
    )
    expect(completedMessage({ itm_url: url, itm_title: url, itm_price: null })).toBe('Completado en Vigía: manomano.es')
  })
})

describe('página abierta en Safari (sesión 44)', () => {
  /** Ejecuta el código del atajo como lo haría «Ejecutar JavaScript en página web». */
  function runShortcutScript(html: string, href: string, canonical: string | null) {
    let out: unknown
    const document = {
      querySelector: (sel: string) => (sel === 'link[rel="canonical"]' && canonical ? { href: canonical } : null),
      documentElement: { outerHTML: html },
    }
    new Function('document', 'location', 'completion', SHORTCUT_PAGE_SCRIPT)(document, { href }, (v: unknown) => {
      out = v
    })
    return out
  }

  it('lo que manda el atajo llega entero a save-link', () => {
    const html = readFileSync(new URL('../scrape/fixtures/kavehome.html', import.meta.url), 'utf8')
    const sent = runShortcutScript(html, 'https://kavehome.com/es/es/p/mesa?utm_source=x', 'https://kavehome.com/es/es/p/mesa')
    const page = parsePage(sent)
    expect(page?.href).toBe('https://kavehome.com/es/es/p/mesa?utm_source=x')
    expect(page?.canonical).toBe('https://kavehome.com/es/es/p/mesa')
    expect(page?.html).toBe(html.slice(0, 3_000_000))
    // Y el lector de siempre saca de ahí el precio de una tienda que bloquea al servidor.
    const read = extractFromHtml(page!.html, page!.href)
    expect(read.price).toBeGreaterThan(0)
    expect(read.title).toBeTruthy()
  })

  it('sin canónica, con null', () => {
    const page = parsePage(runShortcutScript('<html>' + 'x'.repeat(200) + '</html>', 'https://tienda.test/p', null))
    expect(page?.canonical).toBeNull()
  })

  it('rechaza lo que no es una página', () => {
    expect(parsePage(undefined)).toBeNull()
    expect(parsePage('')).toBeNull()
    expect(parsePage('no es json')).toBeNull()
    expect(parsePage(JSON.stringify({ href: 'javascript:alert(1)', html: 'x'.repeat(200) }))).toBeNull()
    expect(parsePage(JSON.stringify({ href: 'https://tienda.test/p', html: 'corto' }))).toBeNull()
  })
})
