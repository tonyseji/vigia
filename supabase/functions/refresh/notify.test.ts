import { describe, it, expect } from 'vitest'
import { alertReasons, buildPushBody, cronCutoffHours, resetsNotified } from './notify.ts'

// Mismo criterio que scrape/extract.test.ts: notify.ts no usa nada de Deno y
// se testea con el runner del repo.

const base = {
  us_refresh_mode: 'daily',
  us_notify_enabled: true,
  us_notify_kind: 'any',
  us_notify_pct: 5,
  us_notify_eur: 10,
  us_notify_min_hist: true,
  us_notify_back_in_stock: true,
}

const change = (over) => ({
  prev: 100,
  next: 100,
  prevMin: 100,
  wasInStock: true,
  nowInStock: true,
  alreadyNotified: null,
  ...over,
})

// El Intl de es-ES separa el importe del € con un espacio duro.
const plain = (s) => s.replace(/ /g, ' ')

describe('cronCutoffHours', () => {
  it('cada modo deja una hora de margen sobre su intervalo', () => {
    expect(cronCutoffHours('6h')).toBe(5)
    expect(cronCutoffHours('12h')).toBe(11)
    expect(cronCutoffHours('daily')).toBe(20)
  })
})

describe('alertReasons', () => {
  it('avisos apagados: nada', () => {
    expect(alertReasons({ ...base, us_notify_enabled: false }, change({ next: 50, prevMin: 60 }))).toEqual([])
  })
  it('precio igual: nada', () => {
    expect(alertReasons(base, change({}))).toEqual([])
  })
  it('cualquier bajada avisa', () => {
    expect(alertReasons(base, change({ next: 99, prevMin: 90 }))).toEqual(['drop'])
  })
  it('bajada por debajo del minimo: bajada y minimo historico', () => {
    expect(alertReasons(base, change({ next: 80, prevMin: 90 }))).toEqual(['drop', 'min_hist'])
  })
  it('umbral en %: 4 % no llega a 5 %, 5 % si', () => {
    const pct = { ...base, us_notify_kind: 'pct' }
    expect(alertReasons(pct, change({ next: 96, prevMin: 90 }))).toEqual([])
    expect(alertReasons(pct, change({ next: 95, prevMin: 90 }))).toEqual(['drop'])
  })
  it('umbral en euros', () => {
    const e = { ...base, us_notify_kind: 'eur' }
    expect(alertReasons(e, change({ next: 91, prevMin: 80 }))).toEqual([])
    expect(alertReasons(e, change({ next: 90, prevMin: 80 }))).toEqual(['drop'])
  })
  it('el minimo historico puentea el umbral', () => {
    const pct = { ...base, us_notify_kind: 'pct', us_notify_pct: 20 }
    expect(alertReasons(pct, change({ next: 97, prevMin: 98 }))).toEqual(['min_hist'])
  })
  it('no repite el aviso del mismo precio', () => {
    expect(alertReasons(base, change({ next: 90, alreadyNotified: 90 }))).toEqual([])
  })
  it('baja por debajo del ultimo aviso: avisa', () => {
    expect(alertReasons(base, change({ next: 85, alreadyNotified: 90, prevMin: 85 }))).toEqual(['drop'])
  })
  it('vuelve a haber stock avisa aunque el precio no baje del ultimo aviso', () => {
    expect(alertReasons(base, change({ prev: 120, next: 120, wasInStock: false, alreadyNotified: 90, prevMin: 90 })))
      .toEqual(['back_in_stock'])
  })
  it('stock desconocido antes o despues no cuenta como reposicion', () => {
    expect(alertReasons(base, change({ wasInStock: null, nowInStock: true }))).toEqual([])
    expect(alertReasons(base, change({ wasInStock: false, nowInStock: undefined }))).toEqual([])
  })
  it('sin precio anterior no hay bajada', () => {
    expect(alertReasons(base, change({ prev: null, next: 50, prevMin: null }))).toEqual([])
  })
})

describe('rebote de precio (avisa 90, sube a 120, baja a 100)', () => {
  it('al subir por encima del ultimo aviso se olvida, y la segunda bajada avisa', () => {
    // pase 2: sube a 120
    expect(resetsNotified(90, 120)).toBe(true)
    expect(alertReasons(base, change({ prev: 90, next: 120, prevMin: 90, alreadyNotified: 90 }))).toEqual([])
    // pase 3: baja a 100, con itm_notified_price ya vaciado
    expect(alertReasons(base, change({ prev: 120, next: 100, prevMin: 90, alreadyNotified: null }))).toEqual(['drop'])
  })
  it('igual o por debajo del ultimo aviso no se olvida', () => {
    expect(resetsNotified(90, 90)).toBe(false)
    expect(resetsNotified(90, 80)).toBe(false)
    expect(resetsNotified(null, 120)).toBe(false)
  })
})

describe('buildPushBody', () => {
  it('una bajada', () => {
    expect(plain(buildPushBody([{ title: 'Mesa', reasons: ['drop'], prev: 100, next: 90 }])))
      .toBe('Mesa: -10 % · 90,00 €')
  })
  it('bajada menor del 1 %: no escribe -0 %', () => {
    expect(plain(buildPushBody([{ title: 'Mesa', reasons: ['drop'], prev: 1000, next: 999 }])))
      .toBe('Mesa: baja de precio · 999,00 €')
  })
  it('vuelve a haber stock: no dice que ha bajado', () => {
    expect(plain(buildPushBody([{ title: 'Mesa', reasons: ['back_in_stock'], prev: 100, next: 110 }])))
      .toBe('Mesa: vuelve a haber stock · 110,00 €')
  })
  it('varios motivos a la vez', () => {
    expect(plain(buildPushBody([{ title: 'Mesa', reasons: ['drop', 'min_hist'], prev: 100, next: 80 }])))
      .toBe('Mesa: -20 %, mínimo histórico · 80,00 €')
  })
  it('varios articulos: los tres primeros y cuantos quedan', () => {
    const a = (title, next) => ({ title, reasons: ['drop'], prev: 100, next })
    const body = plain(buildPushBody([a('A', 90), a('B', 80), a('C', 70), a('D', 60), a('E', 50)]))
    expect(body).toBe('5 artículos con novedades: A (-10 % · 90,00 €); B (-20 % · 80,00 €); C (-30 % · 70,00 €) y 2 más')
  })
  it('recorta titulos largos cuando hay varios', () => {
    const long = 'x'.repeat(60)
    const body = buildPushBody([
      { title: long, reasons: ['drop'], prev: 100, next: 90 },
      { title: 'B', reasons: ['drop'], prev: 100, next: 90 },
    ])
    expect(body).toContain(`${'x'.repeat(39)}…`)
    expect(body).not.toContain('x'.repeat(40))
  })
})
