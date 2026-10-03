import { describe, it, expect } from 'vitest'
import {
  basketLines,
  basketSummary,
  groupByStore,
  storeOf,
  pruneBasket,
  addToBasket,
  setQuantity,
  loadBasket,
  saveBasket,
} from '../basket.js'

const hist = (...prices) => prices.map((p) => ({ ph_price: p }))
const item = (id, price, history = [], url = 'https://www.ikea.com/es/p') => ({
  itm_id: id,
  itm_price: price,
  itm_url: url,
  price_history: history,
})

function memoryStorage() {
  const data = {}
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v)
    },
  }
}

describe('basketLines', () => {
  it('cruza la cesta con los artículos y salta los que no están', () => {
    const itemsById = { a: item('a', 10), b: item('b', 20) }
    const lines = basketLines({ a: 2, x: 1, b: 1 }, itemsById)
    expect(lines.map((l) => [l.item.itm_id, l.qty])).toEqual([
      ['a', 2],
      ['b', 1],
    ])
  })
})

describe('basketSummary', () => {
  it('suma hoy, al guardarlos y mínimo visto, por cantidad', () => {
    const lines = [
      { item: item('a', 90, hist(100, 80, 90)), qty: 2 },
      { item: item('b', 50.5, hist(50.5)), qty: 1 },
    ]
    expect(basketSummary(lines)).toEqual({
      units: 3,
      total: 230.5,
      totalThen: 250.5,
      totalMin: 210.5,
      unpriced: 0,
      stores: 1,
    })
  })

  it('los artículos sin precio no suman pero se cuentan aparte', () => {
    const lines = [
      { item: item('a', 10, hist(10)), qty: 1 },
      { item: item('b', null, hist(null)), qty: 3 },
    ]
    const s = basketSummary(lines)
    expect(s.total).toBe(10)
    expect(s.units).toBe(4)
    expect(s.unpriced).toBe(1)
  })

  it('sin histórico, el precio de hoy hace de referencia y de mínimo', () => {
    const s = basketSummary([{ item: item('a', 12.3), qty: 1 }])
    expect(s.totalThen).toBe(12.3)
    expect(s.totalMin).toBe(12.3)
  })

  it('redondea a céntimos', () => {
    const s = basketSummary([
      { item: item('a', 0.1), qty: 1 },
      { item: item('b', 0.2), qty: 1 },
    ])
    expect(s.total).toBe(0.3)
  })

  it('cuenta tiendas distintas', () => {
    const lines = [
      { item: item('a', 1, [], 'https://www.ikea.com/x'), qty: 1 },
      { item: item('b', 1, [], 'https://ikea.com/y'), qty: 1 },
      { item: item('c', 1, [], 'https://www.kavehome.com/z'), qty: 1 },
    ]
    expect(basketSummary(lines).stores).toBe(2)
  })
})

describe('groupByStore', () => {
  it('agrupa por tienda con subtotal, la más cara primero', () => {
    const lines = [
      { item: item('a', 10, [], 'https://www.ikea.com/x'), qty: 1 },
      { item: item('b', 100, [], 'https://www.kavehome.com/z'), qty: 1 },
      { item: item('c', 5, [], 'https://www.ikea.com/y'), qty: 2 },
    ]
    const groups = groupByStore(lines)
    expect(groups.map((g) => [g.store, g.subtotal, g.lines.length])).toEqual([
      ['kavehome.com', 100, 1],
      ['ikea.com', 20, 2],
    ])
  })
})

describe('storeOf', () => {
  it('se queda con el dominio sin www', () => {
    expect(storeOf('https://www.maisonsdumonde.com/ES/es/p/x.htm')).toBe('maisonsdumonde.com')
    expect(storeOf('no es url')).toBe('no es url')
  })
})

describe('cambios en la cesta', () => {
  it('addToBasket mete con cantidad 1 y respeta las que ya estaban', () => {
    expect(addToBasket({ a: 3 }, ['a', 'b'])).toEqual({ a: 3, b: 1 })
  })

  it('setQuantity a 0 o menos lo quita', () => {
    expect(setQuantity({ a: 3, b: 1 }, 'a', 0)).toEqual({ b: 1 })
    expect(setQuantity({ a: 3 }, 'a', 5)).toEqual({ a: 5 })
  })

  it('pruneBasket quita los artículos que ya no existen', () => {
    const basket = { a: 1, b: 2 }
    expect(pruneBasket(basket, { a: item('a', 1) })).toEqual({ a: 1 })
    // Sin cambios devuelve el mismo objeto (evita guardar y repintar).
    expect(pruneBasket(basket, { a: item('a', 1), b: item('b', 1) })).toBe(basket)
  })
})

describe('almacenamiento', () => {
  it('guarda y recupera la cesta', () => {
    const storage = memoryStorage()
    saveBasket({ a: 2 }, storage)
    expect(loadBasket(storage)).toEqual({ a: 2 })
  })

  it('descarta lo que no sea una cesta válida', () => {
    const storage = memoryStorage()
    storage.setItem('vigia.cesta', '{"a": 2, "b": -1, "c": "x", "d": 1.5}')
    expect(loadBasket(storage)).toEqual({ a: 2 })
    storage.setItem('vigia.cesta', 'no json')
    expect(loadBasket(storage)).toEqual({})
    expect(loadBasket(null)).toEqual({})
  })
})
