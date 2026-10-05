import { describe, it, expect } from 'vitest'
import { itemToText } from '../clipboard.js'
import { formatPrice } from '../format.js'

describe('itemToText', () => {
  const item = { itm_title: 'Lámpara', itm_price: 10, itm_url: 'https://www.vinted.es/items/1', itm_image_url: null }

  it('nombre, precio y dirección', () => {
    expect(itemToText(item)).toBe(`Lámpara\n${formatPrice(10)}\nhttps://www.vinted.es/items/1`)
  })

  it('dice si está vendido o sin stock (B27)', () => {
    expect(itemToText({ ...item, itm_in_stock: false })).toBe(`Lámpara\n${formatPrice(10)} · Vendido\nhttps://www.vinted.es/items/1`)
  })
})
