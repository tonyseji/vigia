import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Publica /extension-config.json con la URL y la clave pública de Supabase,
 * las mismas que ya van dentro del JavaScript de la web. La extensión de
 * Chrome (extension/) las lee de aquí al iniciar sesión: el repositorio es
 * público y no puede llevarlas escritas (CLAUDE.md). */
function extensionConfig(env) {
  return {
    name: 'vigia-extension-config',
    apply: 'build',
    generateBundle() {
      if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) return
      this.emitFile({
        type: 'asset',
        fileName: 'extension-config.json',
        source: JSON.stringify({ supabaseUrl: env.VITE_SUPABASE_URL, anonKey: env.VITE_SUPABASE_ANON_KEY }),
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [react(), tailwindcss(), extensionConfig(env)],
  }
})
