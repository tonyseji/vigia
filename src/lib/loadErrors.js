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

const READ_FAILED = 'No se pudo leer el precio ahora mismo.'

/** Qué decir cuando la función `scrape` contesta con error, y si tiene
 * sentido ofrecer «Guardar sin precio» (que el pase diario lo vuelva a
 * intentar). supabase-js no da el cuerpo en `data` si el estado no es 2xx:
 * lo deja en `error.context` (la Response). Con 502 el cuerpo trae el motivo
 * en palabras llanas (scrape/extract.ts, statusMessage) y `notFound` si la
 * tienda dice que la página no existe: entonces no se ofrece guardar, porque
 * el pase volvería a fallar (sesión 42). */
export async function scrapeFailure(error) {
  const res = error?.context
  if (!res || res.status !== 502 || typeof res.json !== 'function') return { error: READ_FAILED, retryable: true }
  try {
    const body = await res.json()
    const message = typeof body?.error === 'string' && body.error ? body.error : READ_FAILED
    return { error: message, retryable: body?.notFound !== true }
  } catch {
    return { error: READ_FAILED, retryable: true }
  }
}
