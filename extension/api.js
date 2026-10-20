// Sesión y llamadas a Vigía desde la extensión. Solo lo usa background.js:
// la sesión se renueva en un único sitio (si el popup y el service worker
// renovaran el mismo refresh token a la vez, Supabase cerraría la sesión).
//
// La URL y la clave pública de Supabase no van en el repositorio (es
// público, CLAUDE.md): se descargan de la web al iniciar sesión
// (vite.config.js las publica en /extension-config.json).

export const APP_URL = 'https://vigia-list.vercel.app'

export const OFFLINE = 'No hay conexión con Vigía. Revisa la conexión y vuelve a probar.'

/** fetch con un error que se entiende: sin red (o al despertar el ordenador,
 * antes de que vuelva la conexión) fetch falla con «Failed to fetch». */
async function netFetch(url, options) {
  try {
    return await fetch(url, options)
  } catch {
    throw new Error(OFFLINE)
  }
}

async function getConfig() {
  const { config } = await chrome.storage.local.get('config')
  if (config) return config
  const res = await netFetch(`${APP_URL}/extension-config.json`, { cache: 'no-store' })
  if (!res.ok) throw new Error('No se pudo conectar con Vigía. Revisa la conexión.')
  const fresh = await res.json()
  await chrome.storage.local.set({ config: fresh })
  return fresh
}

async function authRequest(grantType, body) {
  const config = await getConfig()
  const res = await netFetch(`${config.supabaseUrl}/auth/v1/token?grant_type=${grantType}`, {
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

/** También olvida la configuración: al volver a entrar se descarga de nuevo
 * (si algún día cambia la clave pública, basta con salir y entrar). */
export async function logout() {
  await chrome.storage.local.remove(['session', 'lastPass', 'config', 'triedNew'])
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
  return netFetch(`${config.supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
}

/** Lo que lee el pase de este Chrome: lo que el servidor no puede leer.
 * Las tiendas que bloquean (itm_is_manual) y, de cualquier tienda, lo que
 * se quedó sin precio o falló en el último pase del servidor (Amazon lo ve
 * desde Irlanda y no enseña el precio de lo que no se envía allí; sesión
 * 37). Todo lo que el usuario ve (la RLS): también lo que otro guardó en
 * una carpeta compartida, que puede no tener Chrome (sesión 44). */
export const CHROME_ITEMS_PATH =
  '/rest/v1/items?select=itm_id,itm_usr_id,itm_url,itm_title,itm_price,itm_last_checked_at,itm_last_error' +
  '&or=(itm_is_manual.eq.true,itm_price.is.null,itm_last_error.not.is.null)'

// Un artículo ajeno que otro Chrome ya leyó bien hace poco no se vuelve a
// leer: con dos Chromes en la carpeta, cada uno apuntaría el suyo cada día.
// «Bien» importa: el pase del servidor pone la fecha aunque falle.
const OTHERS_FRESH_MS = 20 * 60 * 60 * 1000

/** Los propios siempre; los de otros, salvo los leídos bien en las últimas 20 h. */
export function itemsForThisChrome(items, userId, now = Date.now()) {
  return items.filter((item) => {
    if (item.itm_usr_id === userId) return true
    const readOk = item.itm_price != null && !item.itm_last_error && item.itm_last_checked_at
    return !readOk || now - new Date(item.itm_last_checked_at).getTime() > OTHERS_FRESH_MS
  })
}

export async function listChromeItems() {
  const session = await getSession()
  if (!session) throw new Error('Inicia sesión en la extensión.')
  const res = await authedFetch(CHROME_ITEMS_PATH, { headers: { 'Accept-Profile': 'vigia' } })
  if (!res.ok) throw new Error('No se pudo leer tu lista.')
  return itemsForThisChrome(await res.json(), session.user.id)
}

/** Apunta un precio (supabase/functions/record-price). */
export async function recordPrice(data) {
  const res = await authedFetch('/functions/v1/record-price', { method: 'POST', body: JSON.stringify(data) })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error === 'No autorizado' ? 'La sesión ha caducado: vuelve a entrar.' : 'No se pudo guardar en Vigía.')
  return body
}
