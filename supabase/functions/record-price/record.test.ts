import { describe, it, expect } from 'vitest'
import { cleanUrl, itemUpdate, parsePricePayload } from './record.ts'

// Mismo criterio que refresh/notify.test.ts: record.ts no usa nada de Deno.

const ok = { url: 'https://tienda.test/p', title: 'Mesa', image: 'https://tienda.test/m.jpg', price: 120, currency: 'EUR', inStock: true }

describe('parsePricePayload', () => {
  it('acepta un payload correcto y redondea a céntimos', () => {
    expect(parsePricePayload({ ...ok, price: 64.899999 })).toEqual({ ...ok, price: 64.9, altUrl: null, itemId: null })
  })

  it('URL alternativa solo si es otra; id solo si es un uuid', () => {
    const id = '0b9e2a40-1c2d-4e5f-8a9b-0c1d2e3f4a5b'
    expect(parsePricePayload({ ...ok, altUrl: 'https://tienda.test/p?v=2', itemId: id })).toMatchObject({ altUrl: 'https://tienda.test/p?v=2', itemId: id })
    expect(parsePricePayload({ ...ok, altUrl: ok.url, itemId: "x' or 1=1" })).toMatchObject({ altUrl: null, itemId: null })
  })

  it('rechaza sin URL http(s) o con precio raro', () => {
    expect(parsePricePayload({ ...ok, url: 'javascript:alert(1)' })).toBeNull()
    expect(parsePricePayload({ ...ok, price: '120' })).toBeNull()
    expect(parsePricePayload({ ...ok, price: -1 })).toBeNull()
    expect(parsePricePayload({ ...ok, price: NaN })).toBeNull()
    expect(parsePricePayload(null)).toBeNull()
    expect(parsePricePayload('texto')).toBeNull()
  })

  it('limpia lo opcional en vez de rechazar', () => {
    expect(parsePricePayload({ ...ok, title: ' ', image: 'data:x', currency: 'euros', inStock: 'si' })).toEqual({
      url: 'https://tienda.test/p',
      title: null,
      image: null,
      price: 120,
      currency: 'EUR',
      inStock: null,
      altUrl: null,
      itemId: null,
    })
  })
})

describe('cleanUrl', () => {
  it('quita hash y parámetros de seguimiento, conserva el resto', () => {
    expect(cleanUrl('https://t.test/p?utm_source=x&color=rojo&gclid=1#galeria')).toBe('https://t.test/p?color=rojo')
  })
})

describe('itemUpdate', () => {
  const now = '2026-10-01T20:00:00.000Z'
  const data = parsePricePayload(ok)

  it('rellena título e imagen de un artículo guardado a mano', () => {
    const existing = { itm_url: ok.url, itm_title: ok.url, itm_image_url: null, itm_notified_price: null }
    expect(itemUpdate(existing, data, true, now)).toEqual({
      itm_price: 120,
      itm_in_stock: true,
      itm_is_manual: true,
      itm_last_checked_at: now,
      itm_last_error: null,
      itm_title: 'Mesa',
      itm_image_url: 'https://tienda.test/m.jpg',
    })
  })

  it('no pisa un título editado ni una imagen que ya había', () => {
    const existing = { itm_url: ok.url, itm_title: 'Mi mesa', itm_image_url: 'https://otra.test/i.jpg', itm_notified_price: null }
    const update = itemUpdate(existing, data, false, now)
    expect(update).not.toHaveProperty('itm_title')
    expect(update).not.toHaveProperty('itm_image_url')
  })

  it('olvida el último aviso si el precio vuelve a subir por encima', () => {
    const base = { itm_url: ok.url, itm_title: 'Mesa', itm_image_url: null }
    expect(itemUpdate({ ...base, itm_notified_price: 100 }, data, true, now)).toMatchObject({ itm_notified_price: null, itm_notified_at: null })
    expect(itemUpdate({ ...base, itm_notified_price: 130 }, data, true, now)).not.toHaveProperty('itm_notified_price')
  })
})
