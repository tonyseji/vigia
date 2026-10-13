import { defineConfig } from 'vite'

/** Compila el lector de precios del servidor (supabase/functions/scrape/parse.ts)
 * para la extensión y el botón de marcadores: un script que deja
 * `VigiaParse` en la página. `npm run build:parse`; el test
 * parseBundle.test.js falla si extension/parse.js no está al día.
 * Minificado: el botón va en una sola línea y no admite comentarios `//`. */
export const parseBuild = {
  configFile: false,
  logLevel: 'silent',
  publicDir: false,
  build: {
    lib: {
      entry: 'supabase/functions/scrape/parse.ts',
      formats: ['iife'],
      name: 'VigiaParse',
      fileName: () => 'parse.js',
    },
    outDir: 'extension',
    emptyOutDir: false,
    minify: true,
  },
}

export default defineConfig(parseBuild)
