import { useMemo, useState } from 'react'
import { priceChangePct } from '../lib/format.js'
import { folderToText, copyToClipboard } from '../lib/clipboard.js'
import { IconCopiar, IconCheck } from './icons/index.jsx'
import ItemRow from './ItemRow.jsx'

const SORTS = {
  drop: 'Mayor bajada',
  new: 'Más recientes',
  cheap: 'Más baratos',
  exp: 'Más caros',
}

function pctOf(item) {
  const history = item.price_history.map((h) => h.ph_price).filter((p) => p != null)
  const reference = history.length > 1 ? history[0] : null
  if (item.itm_price == null || reference == null) return null
  return priceChangePct(item.itm_price, reference)
}

function sortItems(items, sort) {
  const withPct = items.map((item) => ({ item, pct: pctOf(item) }))
  withPct.sort((a, b) => {
    if (sort === 'cheap') return (a.item.itm_price ?? Infinity) - (b.item.itm_price ?? Infinity)
    if (sort === 'exp') return (b.item.itm_price ?? -Infinity) - (a.item.itm_price ?? -Infinity)
    if (sort === 'new') return new Date(b.item.itm_created_at) - new Date(a.item.itm_created_at)
    return (a.pct ?? 1) - (b.pct ?? 1)
  })
  return withPct.map((x) => x.item)
}

/** Lista de artículos, con búsqueda, orden y el chip "Solo bajadas". Cuando
 * no hay una carpeta seleccionada en el sidebar (`groupByFolder`), agrupa
 * visualmente por carpeta (docs/DISENO.md); si ya viene filtrada a una
 * carpeta concreta, se pinta como lista plana sin repetir el título del
 * grupo — el sidebar ya dice en qué carpeta estás.
 *
 * `comparing`/`selectedIds`/`onToggleSelected` vienen de useComparison
 * (App.jsx): pintan un checkbox por fila cuando el modo comparar está
 * activo, cruzando carpetas — comparar un sofá con un teclado es un caso de
 * uso real (docs/DECISIONES.md, "comparador puntual de conjuntos"). */
export default function ItemList({
  items,
  folders,
  loading,
  onUpdate,
  onDelete,
  groupByFolder = true,
  comparing = false,
  selectedIds,
  onToggleSelected,
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('drop')
  const [onlyDrops, setOnlyDrops] = useState(false)

  const foldersById = useMemo(() => Object.fromEntries(folders.map((f) => [f.fld_id, f])), [folders])

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (onlyDrops) {
        const pct = pctOf(item)
        if (!(pct != null && pct < 0)) return false
      }
      if (!query.trim()) return true
      const q = query.toLowerCase()
      const folderName = foldersById[item.itm_fld_id]?.fld_name ?? ''
      return `${item.itm_title} ${item.itm_url} ${folderName}`.toLowerCase().includes(q)
    })
  }, [items, query, onlyDrops, foldersById])

  const sorted = useMemo(() => sortItems(filtered, sort), [filtered, sort])

  /** Nombre de grupo con la jerarquía visible: "Muebles / Salón" si la
   * carpeta es una subcarpeta, o solo "Muebles" si es de primer nivel. */
  const groupName = useMemo(
    () => (key) => {
      if (key === '__none__') return 'Sin carpeta'
      const folder = foldersById[key]
      if (!folder) return 'Sin carpeta'
      const parent = folder.fld_parent_id ? foldersById[folder.fld_parent_id] : null
      return parent ? `${parent.fld_name} / ${folder.fld_name}` : folder.fld_name
    },
    [foldersById],
  )

  const groups = useMemo(() => {
    const g = {}
    for (const item of sorted) {
      const key = item.itm_fld_id ?? '__none__'
      ;(g[key] = g[key] || []).push(item)
    }
    return Object.entries(g).sort(([a], [b]) => groupName(a).localeCompare(groupName(b), 'es'))
  }, [sorted, groupName])

  function row(item) {
    return (
      <ItemRow
        key={item.itm_id}
        item={item}
        folders={folders}
        onUpdate={onUpdate}
        onDelete={onDelete}
        comparing={comparing}
        selected={selectedIds?.has(item.itm_id)}
        onToggleSelected={onToggleSelected}
      />
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[74px] animate-pulse rounded-lg border border-line bg-surface-2" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <p className="mt-8 text-center text-ink-mut">
        Pega la URL de un producto arriba para empezar a vigilar su precio.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Buscar…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-[110px] flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent"
        >
          {Object.entries(SORTS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-pressed={onlyDrops}
          onClick={() => setOnlyDrops((v) => !v)}
          className="rounded-full border border-line px-3 py-1.5 text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent aria-pressed:border-ok aria-pressed:bg-ok-soft aria-pressed:text-ok"
        >
          Solo bajadas
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="mt-4 text-center text-ink-mut">Nada que coincida.</p>
      ) : groupByFolder ? (
        groups.map(([key, groupItems]) => {
          const name = groupName(key)
          const total = groupItems.reduce((sum, i) => sum + (i.itm_price ?? 0), 0)
          return (
            <section key={key} className="flex flex-col gap-2">
              <h2 className="flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wide text-ink-mut">
                <span>{name}</span>
                <b className="font-mono font-normal normal-case tracking-normal">
                  {groupItems.length} · {total.toLocaleString('es-ES', { minimumFractionDigits: 0 })} €
                </b>
                <span className="h-px flex-1 bg-line" />
                <GroupCopyButton name={name} items={groupItems} />
              </h2>
              <div className="flex flex-col gap-2">{groupItems.map(row)}</div>
            </section>
          )
        })
      ) : (
        <div className="flex flex-col gap-2">
          <p className="flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wide text-ink-mut">
            <span>
              {sorted.length} artículo{sorted.length === 1 ? '' : 's'}
            </span>
            <b className="font-mono font-normal normal-case tracking-normal">
              {sorted.reduce((sum, i) => sum + (i.itm_price ?? 0), 0).toLocaleString('es-ES', { minimumFractionDigits: 0 })} €
            </b>
          </p>
          {sorted.map(row)}
        </div>
      )}
    </div>
  )
}

/** Copia toda la carpeta en texto limpio, para pegarla en una conversación
 * con Claude (docs/DECISIONES.md 2026-09-06, "Las ideas de búsqueda visual..."). */
function GroupCopyButton({ name, items }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyToClipboard(folderToText(name, items))
        if (ok) {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        }
      }}
      aria-label={`Copiar ${name} para Claude`}
      title="Copiar carpeta para Claude"
      className="flex-none text-ink-mut outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
    >
      {copied ? <IconCheck className="h-3.5 w-3.5 text-ok" /> : <IconCopiar className="h-3.5 w-3.5" />}
    </button>
  )
}
