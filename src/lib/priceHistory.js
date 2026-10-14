import { priceChangePct } from './format.js'

/**
 * Lo que cuenta el histórico de un artículo (ventana de histórico, ver
 * docs/DECISIONES.md 2026-10-14): a qué precio entró, cuál fue el mejor
 * momento, el peor, cómo está hoy y cada cambio.
 *
 * Las lecturas se agrupan en tramos: lecturas seguidas al mismo precio. El
 * pase diario apunta una fila aunque no cambie nada, y lo que interesa es
 * cuándo cambió. Las lecturas sin precio no cortan un tramo.
 *
 * `history`: filas de price_history ({ ph_price, ph_checked_at }).
 * Devuelve null si no hay ninguna con precio.
 */
export function priceStory(history) {
  const points = (history ?? [])
    .filter((h) => h.ph_price != null)
    .map((h) => ({ at: h.ph_checked_at, price: Number(h.ph_price) }))
    .sort((a, b) => new Date(a.at) - new Date(b.at))
  if (points.length === 0) return null

  const stretches = []
  for (const p of points) {
    const last = stretches[stretches.length - 1]
    if (last && last.price === p.price) last.to = p.at
    else stretches.push({ price: p.price, from: p.at, to: p.at })
  }

  // El último tramo a ese precio: si volvió a tocar el mínimo, el momento
  // que importa es el más reciente.
  const lastStretchAt = (price) => {
    const i = stretches.findLastIndex((s) => s.price === price)
    const s = stretches[i]
    return { price, from: s.from, to: s.to, isNow: i === stretches.length - 1 }
  }
  const prices = points.map((p) => p.price)

  const changes = []
  for (let i = 1; i < stretches.length; i++) {
    const from = stretches[i - 1].price
    const to = stretches[i].price
    changes.push({ at: stretches[i].from, from, to, pct: priceChangePct(to, from) })
  }
  changes.reverse()

  const first = points[0]
  const last = points[points.length - 1]
  return {
    points,
    entry: { price: first.price, at: first.at },
    current: { price: last.price, at: last.at },
    min: lastStretchAt(Math.min(...prices)),
    max: lastStretchAt(Math.max(...prices)),
    changes,
    readings: points.length,
  }
}
