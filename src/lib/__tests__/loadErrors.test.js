import { describe, it, expect } from 'vitest'
import { loadErrorMessage, scrapeFailure } from '../loadErrors.js'

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

describe('scrapeFailure', () => {
  const withBody = (status, body) => ({ context: new Response(JSON.stringify(body), { status }) })
  const generic = { error: 'No se pudo leer el precio ahora mismo.', retryable: true }

  it('con 502 enseña el motivo y deja guardar sin precio', async () => {
    const msg = 'HTTP 403 (la tienda bloquea la lectura automática)'
    expect(await scrapeFailure(withBody(502, { error: msg, notFound: false }))).toEqual({ error: msg, retryable: true })
  })
  it('si la página no existe no ofrece guardar', async () => {
    const msg = 'La tienda dice que esa página no existe (HTTP 404).'
    expect(await scrapeFailure(withBody(502, { error: msg, notFound: true }))).toEqual({ error: msg, retryable: false })
  })
  it('otro estado (401, 400…) da el texto genérico', async () => {
    expect(await scrapeFailure(withBody(401, { error: 'No autorizado' }))).toEqual(generic)
  })
  it('sin respuesta (fallo de red) da el texto genérico', async () => {
    expect(await scrapeFailure(new Error('Failed to fetch'))).toEqual(generic)
  })
  it('cuerpo que no es JSON da el texto genérico', async () => {
    expect(await scrapeFailure({ context: new Response('<html>', { status: 502 }) })).toEqual(generic)
  })
})
