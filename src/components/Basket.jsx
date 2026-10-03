import { useEffect } from 'react'
import { formatPrice } from '../lib/format.js'
import { groupByStore } from '../lib/basket.js'
import { IconCesta, ProductIcon } from './icons/index.jsx'

function formatDiff(diff) {
  return `${diff > 0 ? '+' : ''}${formatPrice(diff)}`
}

/** Diferencia con lo que costaba al guardarlos; null si no ha cambiado. */
function changeOf(summary) {
  const diff = Math.round((summary.total - summary.totalThen) * 100) / 100
  return diff === 0 ? null : diff
}

function DiffPill({ diff }) {
  return (
    <span
      className="rounded-md px-1.5 py-0.5 font-mono text-[11px] tabular-nums"
      style={{
        background: diff < 0 ? 'var(--color-ok-soft)' : 'var(--color-bad-soft)',
        color: diff < 0 ? 'var(--color-ok)' : 'var(--color-bad)',
      }}
    >
      {formatDiff(diff)}
    </span>
  )
}

function countText(summary) {
  const parts = [`${summary.units} artículo${summary.units === 1 ? '' : 's'}`]
  if (summary.stores > 1) parts.push(`${summary.stores} tiendas`)
  if (summary.unpriced > 0) parts.push(`+${summary.unpriced} sin precio`)
  return parts.join(' · ')
}

/** Barra fija abajo de la pantalla, encima del contenido: se ve hagas
 * scroll o no (la del comparador anterior quedaba al final de la lista). */
export function BasketBar({ summary, picking, onTogglePicking, onOpen }) {
  const diff = changeOf(summary)
  const empty = summary.units === 0
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-5xl items-center gap-3 rounded-xl border border-accent bg-surface px-3 py-2 shadow-lg">
        <IconCesta className="h-5 w-5 flex-none text-accent" />
        {empty ? (
          <span className="min-w-0 flex-1 text-sm text-ink-mut">Marca artículos para meterlos en la cesta.</span>
        ) : (
          <button
            type="button"
            onClick={onOpen}
            className="flex min-w-0 flex-1 flex-col items-start rounded text-left outline-none focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span className="truncate text-xs text-ink-mut">{countText(summary)}</span>
            <span className="flex items-center gap-2">
              <span className="font-mono text-lg font-semibold tabular-nums text-ink">{formatPrice(summary.total)}</span>
              {diff != null && <DiffPill diff={diff} />}
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={onTogglePicking}
          className={`flex-none rounded-lg px-3 py-1.5 text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${picking ? 'bg-accent font-semibold text-surface' : 'border border-line text-ink'}`}
        >
          {picking ? 'Listo' : 'Elegir'}
        </button>
        {!empty && (
          <button
            type="button"
            onClick={onOpen}
            className="hidden flex-none rounded-lg border border-accent px-3 py-1.5 text-sm font-semibold text-accent outline-none focus-visible:outline-2 focus-visible:outline-accent sm:block"
          >
            Ver cesta
          </button>
        )}
      </div>
    </div>
  )
}

/** Detalle de la cesta: por tienda con subtotal, cantidades, y las tres
 * cifras (hoy, al guardarlos, mínimo visto). Hoja desde abajo en móvil,
 * panel lateral en escritorio. */
export function BasketSheet({ lines, summary, onSetQty, onStep, onClear, onAddMore, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const groups = groupByStore(lines)
  const diff = changeOf(summary)
  const showMin = summary.totalMin < summary.total

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/45 sm:items-stretch sm:justify-end" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Cesta"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88dvh] w-full flex-col rounded-t-2xl bg-surface sm:max-h-none sm:w-[420px] sm:rounded-none"
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <IconCesta className="h-5 w-5 text-accent" />
            Cesta
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-2 py-1 text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent"
          >
            Cerrar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {lines.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-mut">La cesta está vacía.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {groups.map((group) => (
                <section key={group.store} className="flex flex-col gap-2">
                  <h3 className="flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wide text-ink-mut">
                    <span className="truncate">{group.store}</span>
                    <span className="h-px flex-1 bg-line" />
                    {group.lines.some((l) => l.item.itm_price != null) && (
                      <b className="flex-none font-mono font-normal normal-case tracking-normal">{formatPrice(group.subtotal)}</b>
                    )}
                  </h3>
                  {group.lines.map((line) => (
                    <BasketLine key={line.item.itm_id} line={line} onSetQty={onSetQty} onStep={onStep} />
                  ))}
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-line px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {lines.length > 0 && (
            <dl className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1 text-sm">
              <dt className="font-semibold text-ink">Hoy</dt>
              <dd className="text-right font-mono text-lg font-semibold tabular-nums">{formatPrice(summary.total)}</dd>
              <dt className="text-ink-mut">Al guardarlos</dt>
              <dd className="flex items-center justify-end gap-2 font-mono tabular-nums text-ink-mut">
                {diff != null && <DiffPill diff={diff} />}
                {formatPrice(summary.totalThen)}
              </dd>
              {showMin && (
                <>
                  <dt className="text-ink-mut">Mínimo visto</dt>
                  <dd className="text-right font-mono tabular-nums text-ok">{formatPrice(summary.totalMin)}</dd>
                </>
              )}
              {summary.unpriced > 0 && (
                <dd className="col-span-2 text-xs text-warn">
                  {summary.unpriced === 1 ? '1 artículo sin precio no suma.' : `${summary.unpriced} artículos sin precio no suman.`}
                </dd>
              )}
            </dl>
          )}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => confirm('¿Vaciar la cesta?') && onClear()}
              disabled={lines.length === 0}
              className="rounded-lg px-2 py-1.5 text-sm text-bad outline-none hover:bg-bad-soft focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
            >
              Vaciar
            </button>
            <button
              type="button"
              onClick={onAddMore}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Añadir más
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function BasketLine({ line, onSetQty, onStep }) {
  const { item, qty } = line
  const stepClass =
    'grid h-7 w-7 place-items-center rounded-md border border-line text-ink outline-none hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40'
  return (
    <div className="flex items-center gap-3">
      <div
        className={`grid h-11 w-11 flex-none place-items-center overflow-hidden rounded-md border border-line ${item.itm_image_url ? 'bg-photo p-0.5' : 'bg-surface-2'}`}
      >
        {item.itm_image_url ? (
          <img src={item.itm_image_url} alt="" className="h-full w-full object-contain mix-blend-multiply" />
        ) : (
          <ProductIcon kind={item.itm_icon} className="h-5 w-5 text-ink-mut" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <a
          href={item.itm_url}
          target="_blank"
          rel="noreferrer"
          className="line-clamp-2 text-[13px] font-medium leading-snug text-ink outline-none focus-visible:outline-2 focus-visible:outline-accent"
        >
          {item.itm_title}
        </a>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => onStep(item.itm_id, -1)} disabled={qty <= 1} aria-label="Una menos" className={stepClass}>
            −
          </button>
          <span className="w-6 text-center font-mono text-sm tabular-nums" aria-label="Cantidad">
            {qty}
          </span>
          <button type="button" onClick={() => onStep(item.itm_id, 1)} aria-label="Una más" className={stepClass}>
            +
          </button>
          <button
            type="button"
            onClick={() => onSetQty(item.itm_id, 0)}
            className="ml-1 rounded px-1 text-xs text-ink-mut outline-none hover:text-bad focus-visible:outline-2 focus-visible:outline-accent"
          >
            Quitar
          </button>
        </div>
      </div>
      <div className="flex flex-none flex-col items-end">
        {item.itm_price == null ? (
          <span className="rounded-md bg-warn-soft px-1.5 py-0.5 text-[10.5px] text-warn">Sin precio</span>
        ) : (
          <>
            <span className="font-mono text-sm font-semibold tabular-nums">{formatPrice(item.itm_price * qty)}</span>
            {qty > 1 && <span className="font-mono text-[11px] tabular-nums text-ink-mut">{formatPrice(item.itm_price)} / ud</span>}
          </>
        )}
      </div>
    </div>
  )
}
