// Sesión y llamadas a Vigía desde la extensión. Solo lo usa background.js:
// la sesión se renueva en un único sitio (si el popup y el service worker
// renovaran el mismo refresh token a la vez, Supabase cerraría la sesión).
//
// La URL y la clave pública de Supabase no van en el repositorio (es
// público, CLAUDE.md): se descargan de la web al iniciar sesión
// (vite.config.js las publica en /extension-config.json).

export const APP_URL = 'https://vigia-list.vercel.app'

async function getConfig() {
  const { config } = await chrome.storage.local.get('config')
  if (config) return config
  const res = await fetch(`${APP_URL}/extension-config.json`, { cache: 'no-store' })
  if (!res.ok) throw new Error('No se pudo conectar con Vigía. Revisa la conexión.')
  const fresh = await res.json()
  await chrome.storage.local.set({ config: fresh })
  return fresh
}

async function authRequest(grantType, body) {
  const config = await getConfig()
  const res = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=${grantType}`, {
    method: 'POST',
    headers: { apikey: config.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data }
}

function toSession(data) {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    user: { id: data.user.id, email: data.user.email },
  }
}

/** Inicia sesión con email y contraseña. La contraseña no se guarda: solo
 * los tokens de esta sesión, que es independiente de la de la web. */
export async function login(email, password) {
  const { ok, data } = await authRequest('password', { email, password })
  if (!ok) {
    throw new Error(data.error_code === 'invalid_credentials' ? 'Email o contraseña incorrectos.' : 'No se pudo iniciar sesión.')
  }
  const session = toSession(data)
  await chrome.storage.local.set({ session })
  return session.user
}

export async function logout() {
  await chrome.storage.local.remove(['session', 'lastPass'])
}

let refreshing = null

/** Sesión válida, renovándola si caduca en menos de un minuto. null si no
 * hay sesión o ya no se puede renovar (hay que volver a entrar). */
export async function getSession() {
  const { session } = await chrome.storage.local.get('session')
  if (!session) return null
  if (session.expiresAt - 60_000 > Date.now()) return session
  refreshing ??= (async () => {
    try {
      const { ok, data } = await authRequest('refresh_token', { refresh_token: session.refreshToken })
      if (!ok) {
        await chrome.storage.local.remove('session')
        return null
      }
      const fresh = toSession(data)
      await chrome.storage.local.set({ session: fresh })
      return fresh
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

async function authedFetch(path, options = {}) {
  const session = await getSession()
  if (!session) throw new Error('Inicia sesión en la extensión.')
  const config = await getConfig()
  return fetch(`${config.supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
}

/** Artículos propios de tiendas que el servidor no puede leer. RLS limita a
 * lo que el usuario ve; el filtro por usuario deja fuera los de carpetas
 * compartidas por otros (esos los actualiza su dueño). */
export async function listManualItems() {
  const session = await getSession()
  if (!session) throw new Error('Inicia sesión en la extensión.')
  const res = await authedFetch(
    `/rest/v1/items?select=itm_id,itm_url,itm_title&itm_is_manual=eq.true&itm_usr_id=eq.${session.user.id}`,
    { headers: { 'Accept-Profile': 'vigia' } },
  )
  if (!res.ok) throw new Error('No se pudo leer tu lista.')
  return res.json()
}

/** Apunta un precio (supabase/functions/record-price). */
export async function recordPrice(data) {
  const res = await authedFetch('/functions/v1/record-price', { method: 'POST', body: JSON.stringify(data) })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error === 'No autorizado' ? 'La sesión ha caducado: vuelve a entrar.' : 'No se pudo guardar en Vigía.')
  return body
}
