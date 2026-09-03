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
