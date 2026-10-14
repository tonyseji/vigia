import { formatDay, formatPct, formatPrice, priceChangePct, showPct } from '../lib/format.js'
import { priceStory } from '../lib/priceHistory.js'
import { displayTitle, stockLabel } from '../lib/itemText.js'
import Dialog from './Dialog.jsx'
import HistoryChart from './HistoryChart.jsx'

/** «Del 5 sep al 9 sep», «el 5 sep» o «desde el 5 sep» si sigue hoy. */
function stretchText(s) {
  if (s.isNow) return s.from === s.to ? `desde el ${formatDay(s.from)}` : `desde el ${formatDay(s.from)}, sigue hoy`
  return formatDay(s.from) === formatDay(s.to) ? `el ${formatDay(s.from)}` : `del ${formatDay(s.from)} al ${formatDay(s.to)}`
}

function Pill({ pct }) {
  if (!showPct(pct)) return null
  return (
    <span
      className="rounded-md px-1.5 py-0.5 font-mono text-[11px] tabular-nums"
      style={{
        background: pct < 0 ? 'var(--color-ok-soft)' : 'var(--color-bad-soft)',
        color: pct < 0 ? 'var(--color-ok)' : 'var(--color-bad)',
      }}
    >
      {formatPct(pct)}
    </span>
  )
}

/** Una cifra del resumen. El punto de color es el mismo que marca ese
 * precio en el gráfico; el texto va siempre en tinta. */
function Stat({ label, dot, price, detail, pct }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-line px-2.5 py-2">
      <span className="flex items-center gap-1.5 text-[11.5px] text-ink-mut">
        <span className="h-2 w-2 flex-none rounded-full" style={dot} aria-hidden="true" />
        {label}
      </span>
      <span className="font-mono text-[15px] font-semibold tabular-nums">{formatPrice(price)}</span>
      <span className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-mut">
        {detail}
        <Pill pct={pct} />
      </span>
    </div>
  )
}

/** Ventana de histórico de un artículo (docs/DECISIONES.md 2026-10-14): a
 * qué precio entró, el mejor y el peor momento, cómo está hoy y cada
 * cambio. Se abre tocando el precio en la fila o en la tarjeta. */
export default function HistoryModal({ item, onClose }) {
  const story = priceStory(item.price_history)
  const today = item.itm_price ?? story?.current.price
  const stock = item.itm_price != null ? stockLabel(item) : null

  return (
    <Dialog title="Histórico de precio" onClose={onClose} className="max-h-full max-w-md gap-3 overflow-y-auto">
      <p className="-mt-2 line-clamp-2 text-sm text-ink-mut">{displayTitle(item)}</p>

      {!story ? (
        <p className="text-sm text-ink-mut">Todavía no hay ningún precio guardado de este artículo.</p>
      ) : (
        <>
          {story.points.length > 1 && <HistoryChart story={story} />}

          <Summary story={story} today={today} />

          <div className="grid grid-cols-2 gap-2">
            <Stat
              label="Entró"
              dot={{ border: '2px solid var(--color-ink-mut)' }}
              price={story.entry.price}
              detail={formatDay(story.entry.at)}
            />
            <Stat
              label="Hoy"
              dot={{ background: 'var(--color-accent)' }}
              price={today}
              detail={stock ?? 'frente a la entrada'}
              pct={stock ? null : priceChangePct(today, story.entry.price)}
            />
            <Stat
              label="Mínimo"
              dot={{ background: 'var(--color-ok)' }}
              price={story.min.price}
              detail={stretchText(story.min)}
            />
            <Stat
              label="Máximo"
              dot={{ background: 'var(--color-bad)' }}
              price={story.max.price}
              detail={stretchText(story.max)}
            />
          </div>

          <section className="flex flex-col gap-1">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-mut">Cambios</h4>
            <ol className="flex flex-col divide-y divide-line text-sm">
              {story.changes.map((c) => (
                <li key={c.at} className="flex items-center gap-2 py-1.5">
                  <span className="w-16 flex-none text-xs text-ink-mut">{formatDay(c.at)}</span>
                  <span className="min-w-0 flex-1 font-mono text-[13px] tabular-nums">
                    <span className="text-ink-mut">{formatPrice(c.from)}</span> → {formatPrice(c.to)}
                  </span>
                  <Pill pct={c.pct} />
                </li>
              ))}
              <li className="flex items-center gap-2 py-1.5">
                <span className="w-16 flex-none text-xs text-ink-mut">{formatDay(story.entry.at)}</span>
                <span className="min-w-0 flex-1">
                  Entra en la lista a <span className="font-mono text-[13px] tabular-nums">{formatPrice(story.entry.price)}</span>
                </span>
              </li>
            </ol>
            <p className="text-xs text-ink-mut">
              {story.readings} {story.readings === 1 ? 'lectura' : 'lecturas'} desde el {formatDay(story.entry.at)}.
            </p>
          </section>
        </>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          autoFocus
          onClick={onClose}
          className="rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent"
        >
          Cerrar
        </button>
      </div>
    </Dialog>
  )
}

/** La frase que responde «¿cuándo habría sido mejor comprarlo?». */
function Summary({ story, today }) {
  const { min, entry, changes } = story
  let text
  if (changes.length === 0) {
    text = `No ha cambiado de precio desde que lo guardaste.`
  } else if (min.isNow) {
    text = `Ahora está en su mínimo: es el mejor momento desde que lo guardaste.`
  } else {
    const vsEntry = priceChangePct(min.price, entry.price)
    const vsMin = priceChangePct(today, min.price)
    text =
      `El mejor momento fue ${stretchText(min)}, a ${formatPrice(min.price)}` +
      (showPct(vsEntry) ? ` (${formatPct(vsEntry)} frente a la entrada)` : ', el precio al que entró') +
      (showPct(vsMin) ? `. Hoy está un ${formatPct(vsMin).replace('+', '')} más caro.` : '.')
  }
  return <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-ink">{text}</p>
}
