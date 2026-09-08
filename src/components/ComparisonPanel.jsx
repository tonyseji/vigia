import { useState } from 'react'
import { formatPrice } from '../lib/format.js'

/** Barra flotante mientras se seleccionan artículos, y los conjuntos ya
 * guardados comparados lado a lado. Todo en memoria: al salir del modo
 * comparación se pierde (docs/DECISIONES.md, "el comparador es puntual"). */
export function CompareBar({ selectedCount, onSave, onCancel }) {
  const [name, setName] = useState('')

  function handleSave() {
    if (!name.trim()) return
    onSave(name)
    setName('')
  }

  return (
    <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-accent bg-surface px-3 py-2 shadow-lg">
      <span className="text-sm text-ink-mut">
        {selectedCount} seleccionado{selectedCount === 1 ? '' : 's'}
      </span>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        placeholder="Nombre del conjunto (p. ej. «Opción A»)"
        disabled={selectedCount === 0}
        className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={selectedCount === 0 || !name.trim()}
        className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
      >
        Guardar conjunto
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent"
      >
        Terminar
      </button>
    </div>
  )
}

/** Conjuntos guardados, lado a lado, con su total y el más barato marcado. */
export function ComparisonSets({ sets, itemsById, onRemove }) {
  if (sets.length === 0) return null

  const totals = sets.map((s) => s.itemIds.reduce((sum, id) => sum + (itemsById[id]?.itm_price ?? 0), 0))
  const cheapest = Math.min(...totals)

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(sets.length, 3)}, minmax(0, 1fr))` }}>
      {sets.map((set, i) => {
        const total = totals[i]
        const isCheapest = total === cheapest && sets.length > 1
        return (
          <div
            key={set.id}
            className={`flex flex-col gap-2 rounded-lg border p-3 ${isCheapest ? 'border-ok bg-ok-soft' : 'border-line bg-surface'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-sm font-semibold text-ink">{set.name}</h3>
              <button
                type="button"
                onClick={() => onRemove(set.id)}
                aria-label={`Quitar conjunto ${set.name}`}
                className="flex-none text-xs text-ink-mut hover:text-bad"
              >
                Quitar
              </button>
            </div>
            <p className="font-mono text-lg font-semibold tabular-nums text-ink">
              {formatPrice(total)}
              {isCheapest && <span className="ml-2 text-xs font-sans font-normal text-ok">Más barato</span>}
            </p>
            <ul className="flex flex-col gap-1 text-xs text-ink-mut">
              {set.itemIds.map((id) => {
                const item = itemsById[id]
                if (!item) return null
                return (
                  <li key={id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{item.itm_title}</span>
                    <span className="flex-none font-mono">{formatPrice(item.itm_price)}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
