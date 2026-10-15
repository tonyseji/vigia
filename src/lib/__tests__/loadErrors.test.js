import { describe, it, expect } from 'vitest'
import { loadErrorMessage, scrapeErrorMessage } from '../loadErrors.js'

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

describe('scrapeErrorMessage', () => {
  const withBody = (status, body) => ({ context: new Response(JSON.stringify(body), { status }) })

  it('con 502 enseña el motivo que manda scrape', async () => {
    const msg = 'La tienda dice que esa página no existe (HTTP 404).'
    expect(await scrapeErrorMessage(withBody(502, { error: msg }))).toBe(msg)
  })
  it('otro estado (401, 400…) da el texto genérico', async () => {
    expect(await scrapeErrorMessage(withBody(401, { error: 'No autorizado' }))).toBe(
      'No se pudo leer el precio. Inténtalo de nuevo.',
    )
  })
  it('sin respuesta (fallo de red) da el texto genérico', async () => {
    expect(await scrapeErrorMessage(new Error('Failed to fetch'))).toBe('No se pudo leer el precio. Inténtalo de nuevo.')
  })
  it('cuerpo que no es JSON da el texto genérico', async () => {
    const error = { context: new Response('<html>', { status: 502 }) }
    expect(await scrapeErrorMessage(error)).toBe('No se pudo leer el precio. Inténtalo de nuevo.')
  })
})
