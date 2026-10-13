import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { build } from 'vite'
import { parseBuild } from '../../../vite.parse.config.js'

// La extensión y el botón de marcadores usan extension/parse.js, compilado
// del lector del servidor. Si alguien cambia parse.ts y no ejecuta
// `npm run build:parse`, los tres caminos dejarían de leer igual.
describe('extension/parse.js', () => {
  it('es la copia compilada de supabase/functions/scrape/parse.ts', async () => {
    const out = await build({ ...parseBuild, build: { ...parseBuild.build, write: false } })
    const code = (Array.isArray(out) ? out[0] : out).output[0].code
    const onDisk = readFileSync('extension/parse.js', 'utf8').replace(/\r\n/g, '\n')
    expect(onDisk === code, 'extension/parse.js no está al día: ejecuta npm run build:parse').toBe(true)
  }, 30_000)
})
