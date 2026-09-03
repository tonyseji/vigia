import { describe, it, expect } from 'vitest'
import { formatPrice, priceChangePct, formatPct } from '../format.js'

// Intl separa el importe del simbolo con un espacio fino (U+202F o U+00A0)
// segun la version de ICU. Se normaliza para que el test no dependa de eso.
const sp = (s) => s.replace(/[  ]/g, ' ')

describe('formatPrice', () => {
  it('formatea en euros con coma decimal', () => {
    expect(sp(formatPrice(1234.5))).toBe('1234,50 €')
  })
  it('agrupa los millares a partir de cinco cifras (convencion es-ES)', () => {
    expect(sp(formatPrice(12345.5))).toBe('12.345,50 €')
  })
  it('devuelve guion cuando no hay precio', () => {
    expect(formatPrice(null)).toBe('—')
    expect(formatPrice(undefined)).toBe('—')
    expect(formatPrice(NaN)).toBe('—')
  })
})

describe('priceChangePct', () => {
  it('calcula una bajada', () => {
    expect(priceChangePct(80, 100)).toBe(-20)
  })
  it('calcula una subida', () => {
    expect(priceChangePct(125, 100)).toBe(25)
  })
  it('protege la division por cero y los nulos', () => {
    expect(priceChangePct(80, 0)).toBeNull()
    expect(priceChangePct(80, null)).toBeNull()
    expect(priceChangePct(null, 100)).toBeNull()
  })
})

describe('formatPct', () => {
  it('pone signo y coma decimal', () => {
    expect(sp(formatPct(-12.345))).toBe('-12,3 %')
    expect(sp(formatPct(4))).toBe('+4,0 %')
  })
  it('devuelve guion sin dato', () => {
    expect(formatPct(null)).toBe('—')
  })
})
