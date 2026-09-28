/** Compartir carpeta con un enlace de invitación (docs/DECISIONES.md,
 * 2026-09-29): un solo uso, caduca a los 7 días. El token lo genera y lo
 * valida la BD (migración 018); aquí solo se transporta y se muestra. */

const PARAM = 'unirse'
const KEY = 'vigia.pendingJoinToken'
// Lo que genera create_folder_share_link: un uuid sin guiones.
const TOKEN_RE = /^[0-9a-f]{32}$/

export function buildShareUrl(origin, token) {
  return `${origin}/?${PARAM}=${token}`
}

export function readJoinToken(search) {
  const token = new URLSearchParams(search).get(PARAM)
  return token && TOKEN_RE.test(token) ? token : null
}

/** URL sin el token, conservando el resto (y el hash que deja el login). */
export function removeJoinParam(href) {
  const url = new URL(href)
  url.searchParams.delete(PARAM)
  return url.toString()
}

function defaultStorage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Quien abre el enlace sin haber entrado tiene que pasar por el login, y
 * el enlace mágico vuelve a la raíz de la app sin el `?unirse=`: el token
 * se guarda aquí hasta que haya sesión. */
export function savePendingJoin(token, storage = defaultStorage()) {
  try {
    storage?.setItem(KEY, token)
  } catch {
    // Sin almacenamiento (modo privado): solo funcionará si ya hay sesión.
  }
}

export function loadPendingJoin(storage = defaultStorage()) {
  try {
    const token = storage?.getItem(KEY)
    return token && TOKEN_RE.test(token) ? token : null
  } catch {
    return null
  }
}

export function clearPendingJoin(storage = defaultStorage()) {
  try {
    storage?.removeItem(KEY)
  } catch {
    // Nada que limpiar si el almacenamiento no está disponible.
  }
}

const dateFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' })

/** Cómo se ve cada acceso en el modal de compartir. */
export function shareLabel(share, now = new Date()) {
  if (share.shr_status === 'accepted') {
    return { who: share.shr_invited_email, status: 'Activo', usableLink: false }
  }
  if (!share.shr_token) {
    return { who: share.shr_invited_email, status: 'Pendiente', usableLink: false }
  }
  const expires = new Date(share.shr_expires_at)
  if (expires <= now) return { who: 'Enlace sin usar', status: 'Caducado', usableLink: false }
  return { who: 'Enlace sin usar', status: `Caduca el ${dateFmt.format(expires)}`, usableLink: true }
}

export function joinErrorMessage(message = '') {
  if (message.includes('enlace_no_valido')) {
    return 'Ese enlace ya se ha usado o ha caducado. Pide uno nuevo a quien te lo envió.'
  }
  if (message.includes('carpeta_propia')) {
    return 'Ese enlace es de tu propia carpeta: ya la tienes.'
  }
  return 'No se pudo unir a la carpeta. Comprueba tu conexión y vuelve a abrir el enlace.'
}
