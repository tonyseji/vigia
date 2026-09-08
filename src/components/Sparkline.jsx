// Minigrafico de evolucion de precio, SVG a mano (CLAUDE.md: cero
// dependencias de graficos). Port directo de la funcion spark() del
// prototipo aprobado (docs/diseno-referencia.html), adaptada a JSX y a los
// tokens reales del proyecto (--color-ok / --color-bad, no --down/--up).
const WIDTH = 74
const HEIGHT = 26
const PAD = 3

export default function Sparkline({ values, direction = 0 }) {
  if (!values || values.length < 2) return null

  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const range = hi - lo || 1
  const points = values.map((v, i) => {
    const x = PAD + (i * (WIDTH - 2 * PAD)) / (values.length - 1)
    const y = HEIGHT - PAD - ((v - lo) / range) * (HEIGHT - 2 * PAD)
    return [x, y]
  })

  const color = direction < 0 ? 'var(--color-ok)' : direction > 0 ? 'var(--color-bad)' : 'var(--color-ink-mut)'
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const last = points[points.length - 1]
  const first = points[0]
  const area = `${line} L${last[0].toFixed(1)} ${(HEIGHT - PAD).toFixed(1)} L${first[0].toFixed(1)} ${(HEIGHT - PAD).toFixed(1)} Z`

  return (
    <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true">
      <path d={area} fill={color} opacity=".13" stroke="none" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="2.4" fill={color} />
    </svg>
  )
}
