import { describe, it, expect } from 'vitest'
import { priceStory } from '../priceHistory.js'

const ph = (price, day) => ({ ph_price: price, ph_checked_at: `2026-09-${String(day).padStart(2, '0')}T08:00:00Z` })
const at = (day) => `2026-09-${String(day).padStart(2, '0')}T08:00:00Z`

describe('priceStory', () => {
  it('sin lecturas con precio no hay historia', () => {
    expect(priceStory([])).toBeNull()
    expect(priceStory([ph(null, 1)])).toBeNull()
    expect(priceStory(undefined)).toBeNull()
  })

  it('entró en 200, bajó a 190 y ahora está en 205', () => {
    const story = priceStory([ph(200, 1), ph(200, 2), ph(190, 5), ph(190, 9), ph(205, 12)])
    expect(story.entry).toEqual({ price: 200, at: at(1) })
    expect(story.current).toEqual({ price: 205, at: at(12) })
    expect(story.min).toEqual({ price: 190, from: at(5), to: at(9), isNow: false })
    expect(story.max).toEqual({ price: 205, from: at(12), to: at(12), isNow: true })
    expect(story.changes.map((c) => [c.at, c.from, c.to])).toEqual([
      [at(12), 190, 205],
      [at(5), 200, 190],
    ])
    expect(story.changes[1].pct).toBeCloseTo(-5)
    expect(story.readings).toBe(5)
  })

  it('el mejor momento es el último tramo al mínimo', () => {
    const story = priceStory([ph(100, 1), ph(90, 2), ph(100, 3), ph(90, 4)])
    expect(story.min).toEqual({ price: 90, from: at(4), to: at(4), isNow: true })
    expect(story.max.from).toBe(at(3))
  })

  it('las lecturas sin precio no cortan un tramo', () => {
    const story = priceStory([ph(50, 1), ph(null, 2), ph(50, 3)])
    expect(story.changes).toEqual([])
    expect(story.min).toEqual({ price: 50, from: at(1), to: at(3), isNow: true })
    expect(story.points).toHaveLength(2)
  })

  it('ordena las lecturas aunque lleguen desordenadas', () => {
    const story = priceStory([ph(80, 3), ph(100, 1)])
    expect(story.entry.price).toBe(100)
    expect(story.current.price).toBe(80)
  })
})
