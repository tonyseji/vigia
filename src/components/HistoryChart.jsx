import { useState } from 'react'
import { formatDay, formatPrice } from '../lib/format.js'

// Gráfico del histórico en la ventana de histórico. SVG a mano, como el
// minigráfico (CLAUDE.md: cero dependencias de gráficos). En escalera y con
// el tiempo real en el eje X: el precio se mantiene hasta la lectura
// siguiente (docs/DECISIONES.md 2026-10-14).
const W = 320
const H = 120
const PAD_X = 6
const PAD_Y = 12

export default function HistoryChart({ story }) {
  const [hover, setHover] = useState(null)
  const { points, entry, min, max } = story

  const t0 = new Date(points[0].at).getTime()
  const span = new Date(points[points.length - 1].at).getTime() - t0 || 1
  const lo = min.price
  const hi = max.price
  const range = hi - lo
  const x = (at) => PAD_X + ((new Date(at).getTime() - t0) / span) * (W - 2 * PAD_X)
  // Precio plano: la línea va al centro, no pegada al borde.
  const y = (price) => (hi === lo ? H / 2 : H - PAD_Y - ((price - lo) / range) * (H - 2 * PAD_Y))

  let line = `M${x(points[0].at).toFixed(1)} ${y(points[0].price).toFixed(1)}`
  for (let i = 1; i < points.length; i++) {
    line += ` H${x(points[i].at).toFixed(1)} V${y(points[i].price).toFixed(1)}`
  }
  const lastX = x(points[points.length - 1].at).toFixed(1)
  const area = `${line} V${H} H${PAD_X} Z`

  // El punto más cercano al dedo o al ratón, por tiempo.
  function pick(e) {
    const box = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * W
    let best = 0
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(x(points[i].at) - px) < Math.abs(x(points[best].at) - px)) best = i
    }
    setHover(best)
  }

  const marks = [
    { key: 'entry', p: { at: entry.at, price: entry.price }, fill: 'var(--color-surface)', stroke: 'var(--color-ink-mut)' },
    { key: 'max', p: { at: max.from, price: max.price }, fill: 'var(--color-bad)', stroke: 'var(--color-surface)', hidden: max.price === min.price },
    { key: 'min', p: { at: min.from, price: min.price }, fill: 'var(--color-ok)', stroke: 'var(--color-surface)', hidden: max.price === min.price },
  ]
  const hovered = hover != null ? points[hover] : null

  return (
    <div className="flex flex-col gap-1">
      <div className="h-4 text-right font-mono text-[11.5px] tabular-nums text-ink-mut" aria-live="polite">
        {hovered && `${formatDay(hovered.at)} · ${formatPrice(hovered.price)}`}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-pan-y select-none overflow-visible"
        role="img"
        aria-label={`Evolución del precio: de ${formatPrice(entry.price)} a ${formatPrice(points[points.length - 1].price)}`}
        onPointerDown={pick}
        onPointerMove={pick}
        onPointerLeave={() => setHover(null)}
      >
        <rect x="0" y="0" width={W} height={H} rx="6" fill="var(--color-surface-2)" opacity=".45" />
        <line
          x1={PAD_X}
          x2={W - PAD_X}
          y1={y(entry.price)}
          y2={y(entry.price)}
          stroke="var(--color-ink-mut)"
          strokeWidth="1"
          strokeDasharray="3 4"
          opacity=".6"
        />
        <path d={area} fill="var(--color-accent)" opacity=".1" stroke="none" />
        <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hovered && (
          <line x1={x(hovered.at)} x2={x(hovered.at)} y1="0" y2={H} stroke="var(--color-ink-mut)" strokeWidth="1" opacity=".5" />
        )}
        {marks.map((m) =>
          m.hidden ? null : (
            <circle key={m.key} cx={x(m.p.at)} cy={y(m.p.price)} r="4" fill={m.fill} stroke={m.stroke} strokeWidth="2" />
          ),
        )}
        <circle cx={lastX} cy={y(points[points.length - 1].price)} r="4" fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth="2" />
        {hovered && (
          <circle cx={x(hovered.at)} cy={y(hovered.price)} r="4.5" fill="var(--color-surface)" stroke="var(--color-ink)" strokeWidth="2" />
        )}
      </svg>
      <div className="flex justify-between text-[11px] text-ink-mut">
        <span>{formatDay(points[0].at)}</span>
        <span>{formatDay(points[points.length - 1].at)}</span>
      </div>
    </div>
  )
}
