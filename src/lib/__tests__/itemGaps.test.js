import { describe, expect, it } from 'vitest'
import { fillUpdate, missingParts, missingText } from '../itemGaps.js'

const url = 'https://www2.hm.com/es_es/productpage.1360669012.html'
const blank = { itm_url: url, itm_title: url, itm_image_url: null, itm_price: null, itm_notified_price: null }
const full = { ...blank, itm_title: 'Funda de cojín', itm_image_url: 'https://img/1.jpg', itm_price: 9.99 }
const NOW = '2026-10-21T10:00:00.000Z'

describe('missingParts', () => {
  it('sin leer la ficha le falta todo', () => {
    expect(missingParts(blank)).toEqual(['precio', 'foto', 'nombre'])
  })
  it('completo no le falta nada', () => {
    expect(missingParts(full)).toEqual([])
  })
  it('con precio a mano pero sin foto ni nombre (el de ManoMano)', () => {
    expect(missingParts({ ...blank, itm_price: 913 })).toEqual(['foto', 'nombre'])
  })
  it('un precio de 0 cuenta como precio', () => {
    expect(missingParts({ ...full, itm_price: 0 })).toEqual([])
  })
})

describe('missingText', () => {
  it('une con comas e «y»', () => {
    expect(missingText(['precio', 'foto', 'nombre'])).toBe('el precio, la foto y el nombre')
    expect(missingText(['foto', 'nombre'])).toBe('la foto y el nombre')
    expect(missingText(['precio'])).toBe('el precio')
  })
})

describe('fillUpdate', () => {
  it('rellena todo lo que faltaba y deja de ser manual', () => {
    const read = { title: 'Funda de cojín', image: 'https://img/1.jpg', price: 9.99, inStock: true }
    expect(fillUpdate(blank, read, NOW)).toEqual({
      itm_price: 9.99,
      itm_in_stock: true,
      itm_is_manual: false,
      itm_last_checked_at: NOW,
      itm_last_error: null,
      itm_title: 'Funda de cojín',
      itm_image_url: 'https://img/1.jpg',
    })
  })
  it('no pisa el título ni la foto que ya tenía', () => {
    const existing = { ...blank, itm_title: 'Mi nombre', itm_image_url: 'https://img/mia.jpg' }
    const update = fillUpdate(existing, { title: 'Otro', image: 'https://img/otra.jpg', price: 10 }, NOW)
    expect(update.itm_title).toBeUndefined()
    expect(update.itm_image_url).toBeUndefined()
    expect(update.itm_price).toBe(10)
  })
  it('sin precio en la lectura no toca el precio ni la fecha de lectura', () => {
    expect(fillUpdate(blank, { title: 'Funda', image: 'https://img/1.jpg' }, NOW)).toEqual({
      itm_title: 'Funda',
      itm_image_url: 'https://img/1.jpg',
    })
  })
  it('vacío si la lectura no trae nada de lo que faltaba', () => {
    expect(fillUpdate({ ...full, itm_price: null }, { title: 'Funda', image: 'https://img/2.jpg' }, NOW)).toEqual({})
  })
  it('si sube por encima del último aviso, la próxima bajada vuelve a avisar', () => {
    const update = fillUpdate({ ...blank, itm_notified_price: 8 }, { price: 9.99 }, NOW)
    expect(update.itm_notified_price).toBeNull()
    expect(update.itm_notified_at).toBeNull()
  })
})
