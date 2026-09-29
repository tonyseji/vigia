import { describe, it, expect } from 'vitest'
import { loadErrorMessage } from '../loadErrors.js'

describe('loadErrorMessage', () => {
  it('sin fallos no hay aviso', () => {
    expect(loadErrorMessage({ items: false, folders: false, shares: false, settings: false })).toBeNull()
    expect(loadErrorMessage({})).toBeNull()
  })
  it('nombra lo único que ha fallado', () => {
    expect(loadErrorMessage({ folders: true })).toBe('No se han podido cargar tus carpetas.')
    expect(loadErrorMessage({ settings: true })).toBe('No se han podido cargar tus ajustes.')
  })
  it('junta dos fallos con «y»', () => {
    expect(loadErrorMessage({ items: true, folders: true })).toBe('No se han podido cargar tus artículos y carpetas.')
  })
  it('junta tres o más con comas y «y», en orden fijo', () => {
    expect(loadErrorMessage({ shares: true, items: true, settings: true, folders: true })).toBe(
      'No se han podido cargar tus artículos, carpetas, invitaciones y ajustes.',
    )
  })
})
