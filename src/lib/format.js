const eur = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
})

/** 1234.5 -> "1.234,50 €". null/undefined/NaN -> "—". */
export function formatPrice(cents) {
  if (cents == null || Number.isNaN(cents)) return '—'
  return eur.format(cents)
}

/**
 * Variacion entre dos precios, en porcentaje con signo.
 * Devuelve null si no se puede calcular (sin referencia o referencia 0).
 */
export function priceChangePct(current, reference) {
  if (current == null || reference == null || reference === 0) return null
  return ((current - reference) / reference) * 100
}

/** -12.345 -> "-12,3 %". null -> "—". */
export function formatPct(pct) {
  if (pct == null || Number.isNaN(pct)) return '—'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1).replace('.', ',')} %`
}

/** Si merece píldora de variación: sin cambio (o uno que redondea a
 * "0,0 %") no se enseña, igual que la franja lateral queda sin color. */
export function showPct(pct) {
  return pct != null && !Number.isNaN(pct) && Math.abs(pct) >= 0.05
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "2026-09-03T08:00Z" -> "3 sep" (con el año si no es el de `now`).
 * Meses a mano: según la versión de ICU, Intl da «sep» o «sept». */
export function formatDay(iso, now = new Date()) {
  if (!iso) return '—'
  const d = new Date(iso)
  const day = `${d.getDate()} ${MONTHS[d.getMonth()]}`
  return d.getFullYear() === now.getFullYear() ? day : `${day} ${d.getFullYear()}`
}
