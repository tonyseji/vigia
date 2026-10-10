import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Regla anti-deriva de CLAUDE.md: el historial va en docs/PROGRESO.md. Este
// test falla en el CI si el «Estado actual» vuelve a crecer como log de
// sesiones (llegó a ~80 líneas antes de la sesión 38).
const claudeMd = readFileSync(fileURLToPath(new URL('../../../CLAUDE.md', import.meta.url)), 'utf8')
  .replace(/\r\n/g, '\n')

function section(title) {
  const start = claudeMd.indexOf(`## ${title}\n`)
  if (start === -1) return null
  const end = claudeMd.indexOf('\n---\n', start)
  return claudeMd.slice(start, end === -1 ? undefined : end)
}

describe('CLAUDE.md', () => {
  it('tiene la sección «Estado actual» con la última sesión', () => {
    const estado = section('Estado actual')
    expect(estado).not.toBeNull()
    expect(estado).toMatch(/Última sesión: \d+\./)
  })

  it('el «Estado actual» no pasa de 15 líneas con texto', () => {
    const lines = section('Estado actual').split('\n').filter((l) => l.trim() !== '')
    expect(lines.length).toBeLessThanOrEqual(15)
  })

  it('el archivo entero no pasa de 250 líneas', () => {
    expect(claudeMd.split('\n').length).toBeLessThanOrEqual(250)
  })
})
