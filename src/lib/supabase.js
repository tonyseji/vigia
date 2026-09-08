import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copia .env.example a .env.',
  )
}

// Cliente unico para toda la app. Nunca instanciar createClient en otro sitio:
// varias instancias se pisan la sesion en localStorage.
// schema: 'vigia' porque las tablas nuevas viven en su propio schema, no en
// public (docs/DECISIONES.md, 2026-09-03) — public sigue siendo de la app vieja.
export const supabase = createClient(url, anonKey, {
  db: { schema: 'vigia' },
})
