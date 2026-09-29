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
