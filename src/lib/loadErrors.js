/** Qué se lee al abrir la app, en el orden en que se nombra en el aviso. */
const PARTS = [
  ['items', 'artículos'],
  ['folders', 'carpetas'],
  ['shares', 'invitaciones'],
  ['settings', 'ajustes'],
]

/** Texto del aviso cuando falla alguna lectura de la BD, o null si no ha
 * fallado ninguna. Sin este aviso un fallo se veía como una lista vacía
 * (backlog B16). */
export function loadErrorMessage(failed) {
  const names = PARTS.filter(([key]) => failed[key]).map(([, name]) => name)
  if (names.length === 0) return null
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`
  return `No se han podido cargar tus ${list}.`
}

const READ_FAILED = 'No se pudo leer el precio. Inténtalo de nuevo.'

/** Texto para cuando la función `scrape` contesta con error. supabase-js
 * no da el cuerpo en `data` si el estado no es 2xx: lo deja en
 * `error.context` (la Response). Con 502 el cuerpo trae el motivo en
 * palabras llanas (scrape/extract.ts, statusMessage); antes se tapaba
 * siempre con «Inténtalo de nuevo», también cuando el anuncio ya no
 * existía y reintentar no servía de nada (sesión 42). */
export async function scrapeErrorMessage(error) {
  const res = error?.context
  if (!res || res.status !== 502 || typeof res.json !== 'function') return READ_FAILED
  try {
    const body = await res.json()
    return typeof body?.error === 'string' && body.error ? body.error : READ_FAILED
  } catch {
    return READ_FAILED
  }
}
