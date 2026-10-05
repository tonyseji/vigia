import { describe, it, expect } from 'vitest'
import {
  bookmarkletSource,
  buildBookmarklet,
  parseImport,
  readImport,
  removeImportHash,
  savePendingImport,
  loadPendingImport,
  clearPendingImport,
  getOrCreateBookmarkletKey,
  isTrustedImport,
  manualPriceStatus,
} from '../browserImport.js'

const ORIGIN = 'https://vigia-list.vercel.app'
const KEY = '0123456789abcdef0123456789abcdef'

/** Página mínima: solo lo que usa el botón (querySelector/All, title). */
function fakePage({ jsonLd = [], metas = {}, canonical = null, title = 'Página', href = 'https://tienda.test/p/1' }) {
  const scripts = jsonLd.map((j) => ({ textContent: typeof j === 'string' ? j : JSON.stringify(j) }))
  const document = {
    title,
    querySelectorAll: () => scripts,
    querySelector: (sel) => {
      if (sel === 'link[rel="canonical"]') return canonical ? { href: canonical } : null
      const key = /meta\[property="([^"]+)"/.exec(sel)?.[1]
      return key in metas ? { getAttribute: () => metas[key] } : null
    },
  }
  return { document, location: { href } }
}

/** Ejecuta el botón sobre la página y devuelve lo que abriría (o la alerta). */
function runBookmarklet(page, key = KEY) {
  const opened = []
  const alerts = []
  const run = new Function('document', 'location', 'window', 'alert', bookmarkletSource(ORIGIN, key))
  run(page.document, page.location, { open: (url) => opened.push(url) }, (msg) => alerts.push(msg))
  return { opened, alerts }
}

const MDM = {
  '@type': 'Product',
  name: 'Vitrina de 2 puertas correderas de cristal verde oscuro 90 cm',
  image: ['https://medias.maisonsdumonde.com/img/253385_0.jpg'],
  offers: [{ '@type': 'Offer', price: 289, priceCurrency: 'EUR', availability: 'https://schema.org/InStock' }],
}

describe('botón del navegador', () => {
  it('lee el JSON-LD de una ficha de Maisons du Monde y abre Vigía con los datos', () => {
    const page = fakePage({
      jsonLd: [{ '@type': 'BreadcrumbList' }, MDM],
      canonical: 'https://www.maisonsdumonde.com/ES/es/p/vitrina-illa-253385.htm',
    })
    const { opened, alerts } = runBookmarklet(page)
    expect(alerts).toEqual([])
    expect(opened).toHaveLength(1)
    expect(opened[0].startsWith(`${ORIGIN}/#importar=`)).toBe(true)
    expect(readImport(new URL(opened[0]).hash)).toEqual({
      url: 'https://www.maisonsdumonde.com/ES/es/p/vitrina-illa-253385.htm',
      title: MDM.name,
      image: 'https://medias.maisonsdumonde.com/img/253385_0.jpg',
      price: 289,
      currency: 'EUR',
      inStock: true,
      altUrl: 'https://tienda.test/p/1',
      key: KEY,
    })
  })

  it('encuentra el producto dentro de @graph y con precio en texto', () => {
    const page = fakePage({
      jsonLd: [{ '@graph': [{ '@type': ['Product'], name: 'Lámpara', offers: { price: '1.299,50', availability: 'OutOfStock' } }] }],
    })
    const data = readImport(new URL(runBookmarklet(page).opened[0]).hash)
    expect(data.price).toBe(1299.5)
    expect(data.inStock).toBe(false)
    expect(data.url).toBe('https://tienda.test/p/1')
    expect(data.altUrl).toBeNull() // sin canónica, la de la barra es la misma
  })

  it('BackOrder (Sklum, entrega más tarde) cuenta como en stock', () => {
    const page = fakePage({
      jsonLd: [{ '@type': 'Product', name: 'Mesita', offers: { price: 94.95, availability: 'https://schema.org/BackOrder' } }],
    })
    expect(readImport(new URL(runBookmarklet(page).opened[0]).hash).inStock).toBe(true)
  })

  it('sin JSON-LD usa las metas de Open Graph', () => {
    const page = fakePage({
      jsonLd: ['{no es json'],
      metas: { 'og:title': 'Silla', 'og:image': 'https://tienda.test/silla.jpg', 'product:price:amount': '59.90' },
    })
    const data = readImport(new URL(runBookmarklet(page).opened[0]).hash)
    expect(data).toMatchObject({ title: 'Silla', image: 'https://tienda.test/silla.jpg', price: 59.9, inStock: null })
  })

  it('sin precio avisa y no abre nada', () => {
    const { opened, alerts } = runBookmarklet(fakePage({ jsonLd: [{ '@type': 'WebPage' }] }))
    expect(opened).toEqual([])
    expect(alerts).toHaveLength(1)
  })

  it('un botón sin clave (o con una mal formada) manda key null', () => {
    const page = fakePage({ jsonLd: [MDM] })
    expect(readImport(new URL(runBookmarklet(page, '').opened[0]).hash).key).toBeNull()
    expect(readImport(new URL(runBookmarklet(page, "x'+alert(1)+'").opened[0]).hash).key).toBeNull()
  })

  it('el enlace de una línea, tal cual queda en el marcador, funciona', () => {
    const code = decodeURIComponent(buildBookmarklet(ORIGIN, KEY).slice('javascript:'.length))
    const opened = []
    const run = new Function('document', 'location', 'window', 'alert', code)
    run(fakePage({ jsonLd: [MDM] }).document, { href: 'https://tienda.test/p/1' }, { open: (url) => opened.push(url) }, () => {})
    expect(readImport(new URL(opened[0]).hash)).toMatchObject({ price: 289, key: KEY })
  })

  it('si el navegador bloquea la pestaña nueva, abre Vigía en la misma', () => {
    const location = { href: 'https://tienda.test/p/1' }
    const run = new Function('document', 'location', 'window', 'alert', bookmarkletSource(ORIGIN, KEY))
    run(fakePage({ jsonLd: [MDM] }).document, location, { open: () => null }, () => {})
    expect(location.href.startsWith(`${ORIGIN}/#importar=`)).toBe(true)
  })

  it('el enlace es un javascript: de una sola línea', () => {
    const link = buildBookmarklet(ORIGIN, KEY)
    expect(link.startsWith('javascript:')).toBe(true)
    expect(decodeURIComponent(link.slice('javascript:'.length))).not.toContain('\n')
    expect(decodeURIComponent(link)).toContain(`'${ORIGIN}/#importar='`)
  })
})

describe('parseImport', () => {
  const ok = { u: 'https://tienda.test/p', t: 'Mesa', i: 'https://tienda.test/m.jpg', p: 120, c: 'EUR', s: true }

  it('rechaza URLs que no son http(s) y precios raros', () => {
    expect(parseImport({ ...ok, u: 'javascript:alert(1)' })).toBeNull()
    expect(parseImport({ ...ok, p: '120' })).toBeNull()
    expect(parseImport({ ...ok, p: -1 })).toBeNull()
    expect(parseImport({ ...ok, p: Infinity })).toBeNull()
    expect(parseImport(null)).toBeNull()
  })

  it('limpia lo opcional en vez de rechazar', () => {
    expect(parseImport({ ...ok, t: '  ', i: 'data:image/png;base64,xx', c: 'euros', s: 'si' })).toEqual({
      url: 'https://tienda.test/p',
      title: 'https://tienda.test/p',
      image: null,
      price: 120,
      currency: 'EUR',
      inStock: null,
      altUrl: null,
      key: null,
    })
    expect(parseImport({ ...ok, t: 'x'.repeat(500) }).title).toHaveLength(300)
  })
})

describe('readImport / removeImportHash', () => {
  it('ignora otros hashes (los del login) y basura', () => {
    expect(readImport('#access_token=abc&type=magiclink')).toBeNull()
    expect(readImport('#importar=%%%')).toBeNull()
    expect(readImport('#importar=bm8')).toBeNull()
    expect(readImport('')).toBeNull()
    expect(readImport(undefined)).toBeNull()
  })

  it('quita solo el hash de importar', () => {
    expect(removeImportHash('https://v.test/?a=1#importar=xyz')).toBe('https://v.test/?a=1')
    expect(removeImportHash('https://v.test/#access_token=abc')).toBe('https://v.test/#access_token=abc')
  })
})

function memoryStorage() {
  const data = {}
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v)
    },
    removeItem: (k) => {
      delete data[k]
    },
  }
}

const broken = {
  getItem: () => {
    throw new Error('bloqueado')
  },
  setItem: () => {
    throw new Error('bloqueado')
  },
  removeItem: () => {
    throw new Error('bloqueado')
  },
}

describe('importación pendiente', () => {
  const data = { url: 'https://tienda.test/p', title: 'Mesa', image: null, price: 120, currency: 'EUR', inStock: null, altUrl: 'https://tienda.test/p?v=2', key: KEY }

  it('se guarda, se recupera validada y se borra', () => {
    const storage = memoryStorage()
    savePendingImport(data, storage)
    expect(loadPendingImport(storage)).toEqual(data)
    clearPendingImport(storage)
    expect(loadPendingImport(storage)).toBeNull()
  })

  it('descarta lo que no valide y no rompe sin almacenamiento', () => {
    const storage = memoryStorage()
    storage.setItem('vigia.pendingImport', JSON.stringify({ ...data, url: 'ftp://x' }))
    expect(loadPendingImport(storage)).toBeNull()
    expect(() => savePendingImport(data, broken)).not.toThrow()
    expect(loadPendingImport(broken)).toBeNull()
    expect(() => clearPendingImport(broken)).not.toThrow()
  })
})

describe('clave del botón', () => {
  it('se crea una vez y se reutiliza', () => {
    const storage = memoryStorage()
    const key = getOrCreateBookmarkletKey(storage)
    expect(key).toMatch(/^[0-9a-f]{32}$/)
    expect(getOrCreateBookmarkletKey(storage)).toBe(key)
  })

  it('solo se fía de un botón con la clave de este navegador', () => {
    const storage = memoryStorage()
    getOrCreateBookmarkletKey(storage, () => KEY)
    expect(isTrustedImport({ key: KEY }, storage)).toBe(true)
    expect(isTrustedImport({ key: 'f'.repeat(32) }, storage)).toBe(false)
    expect(isTrustedImport({ key: null }, storage)).toBe(false)
    expect(isTrustedImport({ key: KEY }, memoryStorage())).toBe(false)
    expect(isTrustedImport({ key: KEY }, broken)).toBe(false)
  })

  it('sin almacenamiento devuelve una clave igualmente', () => {
    expect(getOrCreateBookmarkletKey(broken, () => KEY)).toBe(KEY)
  })
})

describe('manualPriceStatus', () => {
  const now = Date.parse('2026-10-03T10:00:00Z')
  const ph = (source, at) => ({ ph_price: 10, ph_source: source, ph_checked_at: at })

  it('null en tiendas que el servidor sí lee', () => {
    expect(manualPriceStatus({ itm_is_manual: false, price_history: [] }, now)).toBeNull()
  })

  it("'browser' si el último precio vino del navegador hace menos de dos días", () => {
    const item = { itm_is_manual: true, price_history: [ph('manual', '2026-09-20T10:00:00Z'), ph('browser', '2026-10-02T09:00:00Z')] }
    expect(manualPriceStatus(item, now)).toBe('browser')
  })

  it("'manual' si es viejo, tecleado o no hay histórico", () => {
    expect(manualPriceStatus({ itm_is_manual: true, price_history: [ph('browser', '2026-09-30T09:00:00Z')] }, now)).toBe('manual')
    expect(manualPriceStatus({ itm_is_manual: true, price_history: [ph('manual', '2026-10-03T09:00:00Z')] }, now)).toBe('manual')
    expect(manualPriceStatus({ itm_is_manual: true, price_history: [] }, now)).toBe('manual')
  })
})

