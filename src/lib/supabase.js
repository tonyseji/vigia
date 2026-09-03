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
export const supabase = createClient(url, anonKey)
