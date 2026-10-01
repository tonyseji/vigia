/** Vigía en el menú Compartir de Android (share_target en public/manifest.json).
 *
 * Android abre la app instalada en /compartir?title=…&text=…&url=…. Cada app
 * rellena esos campos a su manera: Chrome suele mandar la dirección en `url`,
 * otras la meten en `text` junto a una frase («Mira esto: https://…»). Se
 * coge la primera dirección web que aparezca. iOS no admite share_target en
 * apps web: allí se usa el botón «Guardar en Vigía». */

export const SHARE_PATH = '/compartir'
const STORAGE_KEY = 'vigia.pendingShare'
const URL_IN_TEXT = /https?:\/\/[^\s<>"']+/i

function httpUrl(value) {
  if (typeof value !== 'string' || value.length > 2000) return null
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

/** La dirección compartida, o null si no es /compartir o no trae ninguna. */
export function readSharedUrl(pathname, search) {
  if (pathname.replace(/\/+$/, '') !== SHARE_PATH) return null
  const params = new URLSearchParams(search)
  for (const field of ['url', 'text', 'title']) {
    const value = params.get(field)
    if (!value) continue
    const direct = httpUrl(value)
    if (direct) return direct
    const found = URL_IN_TEXT.exec(value)
    if (found) {
      // Quita la puntuación que suele pegarse al final de una frase.
      const url = httpUrl(found[0].replace(/[.,;:!?)\]]+$/, ''))
      if (url) return url
    }
  }
  return null
}

function defaultStorage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Como el enlace de invitación (shareLink.js): si no hay sesión, la
 * dirección espera aquí a que se entre. */
export function savePendingShare(url, storage = defaultStorage()) {
  try {
    storage?.setItem(STORAGE_KEY, url)
  } catch {
    // Sin almacenamiento: solo funcionará si ya hay sesión.
  }
}

export function loadPendingShare(storage = defaultStorage()) {
  try {
    return httpUrl(storage?.getItem(STORAGE_KEY) ?? '')
  } catch {
    return null
  }
}

export function clearPendingShare(storage = defaultStorage()) {
  try {
    storage?.removeItem(STORAGE_KEY)
  } catch {
    // Nada que limpiar si el almacenamiento no está disponible.
  }
}
