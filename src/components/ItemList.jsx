import { useEffect, useMemo, useState } from 'react'
import { formatPrice, priceChangePct } from '../lib/format.js'
import { displayTitle, normalizeSearch } from '../lib/itemText.js'
import { folderToText, copyToClipboard } from '../lib/clipboard.js'
import {
  groupByFolder as groupItemsByFolder,
  folderGroupName,
  loadView,
  saveView,
  loadCollapsed,
  saveCollapsed,
  groupKeyOf,
  itemsTotal,
  favoritesFirst,
} from '../lib/itemGroups.js'
import { IconCopiar, IconCheck, IconChevronRight, IconCarpeta, IconEstrella } from './icons/index.jsx'
import ItemRow from './ItemRow.jsx'
import ItemTile from './ItemTile.jsx'

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

/** Lista de artículos, con búsqueda, orden y los chips «Solo favoritos» y
 * «Solo bajadas». Los favoritos van primero con cualquier orden, también
 * dentro de cada carpeta (docs/DECISIONES.md 2026-10-16). Cuando
 * no hay una carpeta seleccionada en el sidebar (`groupByFolder`), agrupa
 * visualmente por carpeta (docs/DISENO.md); si ya viene filtrada a una
 * carpeta concreta, se pinta como lista plana sin repetir el título del
 * grupo, pero con su nombre arriba y un «Todos» para volver: en el móvil
 * el sidebar está escondido y no se veía en qué carpeta estabas.
 *
 * `justAdded` ({ id }) es el artículo recién guardado: se quita lo que lo
 * esconda (búsqueda, «Solo favoritos», «Solo bajadas», grupo plegado), se lleva a la vista y
 * se ilumina un momento.
 *
 * `picking`/`basket`/`onToggleBasket` vienen de useBasket (App.jsx): con
 * la cesta en modo elegir, cada fila y cada tarjeta lleva una casilla,
 * cruzando carpetas (docs/superpowers/specs/2026-10-03-cesta-design.md). */
export default function ItemList({
  items,
  folders,
  loading,
  loadFailed,
  onUpdate,
  onDelete,
  groupByFolder = true,
  picking = false,
  basket,
  onToggleBasket,
  onToggleFavorite,
  folderName = null,
  onShowAll,
  justAdded = null,
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('drop')
  const [onlyDrops, setOnlyDrops] = useState(false)
  const [onlyFavs, setOnlyFavs] = useState(false)
  const [view, setViewState] = useState(loadView)

  function setView(next) {
    setViewState(next)
    saveView(next)
  }

  // Grupos plegados, como las carpetas del sidebar; se recuerdan. Buscando
  // se abren todos: plegados esconderían lo que coincide.
  const [collapsed, setCollapsed] = useState(loadCollapsed)
  const searching = query.trim() !== ''

  function toggleGroup(key) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      saveCollapsed(next)
      return next
    })
  }

  const foldersById = useMemo(() => Object.fromEntries(folders.map((f) => [f.fld_id, f])), [folders])

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (onlyFavs && !item.isFavorite) return false
      if (onlyDrops) {
        const pct = pctOf(item)
        if (!(pct != null && pct < 0)) return false
      }
      if (!query.trim()) return true
      const q = normalizeSearch(query.trim())
      const itemFolder = foldersById[item.itm_fld_id]?.fld_name ?? ''
      return normalizeSearch(`${displayTitle(item)} ${item.itm_url} ${itemFolder}`).includes(q)
    })
  }, [items, query, onlyFavs, onlyDrops, foldersById])

  const sorted = useMemo(() => favoritesFirst(sortItems(filtered, sort)), [filtered, sort])

  // «Sin carpeta» primero, el resto por nombre (src/lib/itemGroups.js).
  const groups = useMemo(() => groupItemsByFolder(sorted, foldersById), [sorted, foldersById])

  const justAddedId = justAdded?.id ?? null
  const justAddedItem = items.find((i) => i.itm_id === justAddedId)
  const justAddedKey = justAddedItem ? groupKeyOf(justAddedItem, foldersById) : null

  useEffect(() => {
    if (!justAddedId) return
    setQuery('')
    setOnlyFavs(false)
    setOnlyDrops(false)
    if (justAddedKey) {
      setCollapsed((prev) => {
        if (!prev.has(justAddedKey)) return prev
        const next = new Set(prev)
        next.delete(justAddedKey)
        saveCollapsed(next)
        return next
      })
    }
    // Tras pintar sin filtros: entonces la fila ya existe.
    const frame = requestAnimationFrame(() => {
      document.querySelector(`[data-item-id="${justAddedId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(frame)
    // Solo al llegar un guardado nuevo (justAdded cambia de objeto).
  }, [justAdded])

  // Marcar o quitar mueve la fila (los favoritos van primero): la pantalla
  // la sigue, para que no se vaya de debajo del dedo sin ver adónde.
  async function toggleFavorite(itemId, favorite) {
    const done = onToggleFavorite?.(itemId, favorite)
    requestAnimationFrame(() => {
      document.querySelector(`[data-item-id="${itemId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
    return done
  }

  function row(item) {
    return (
      <ItemRow
        key={item.itm_id}
        justAdded={item.itm_id === justAddedId}
        item={item}
        folders={folders}
        onUpdate={onUpdate}
        onDelete={onDelete}
        picking={picking}
        inBasket={Boolean(basket?.[item.itm_id])}
        onToggleBasket={onToggleBasket}
        onToggleFavorite={toggleFavorite}
      />
    )
  }

  function tile(item) {
    return (
      <ItemTile
        key={item.itm_id}
        justAdded={item.itm_id === justAddedId}
        item={item}
        folders={folders}
        onUpdate={onUpdate}
        onDelete={onDelete}
        picking={picking}
        inBasket={Boolean(basket?.[item.itm_id])}
        onToggleBasket={onToggleBasket}
        onToggleFavorite={toggleFavorite}
      />
    )
  }

  function itemsView(list) {
    return view === 'list' ? (
      <div className="flex flex-col gap-2">{list.map(row)}</div>
    ) : (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">{list.map(tile)}</div>
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

  // Si la lectura falló, el aviso de App ya lo explica: invitar a pegar la
  // primera URL haría creer que la lista está vacía de verdad (B16).
  if (items.length === 0 && loadFailed) return null

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
          aria-pressed={onlyFavs}
          onClick={() => setOnlyFavs((v) => !v)}
          className="flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent aria-pressed:border-fav aria-pressed:text-fav"
        >
          <IconEstrella filled={onlyFavs} className="h-3.5 w-3.5" />
          Solo favoritos
        </button>
        <button
          type="button"
          aria-pressed={onlyDrops}
          onClick={() => setOnlyDrops((v) => !v)}
          className="rounded-full border border-line px-3 py-1.5 text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent aria-pressed:border-ok aria-pressed:bg-ok-soft aria-pressed:text-ok"
        >
          Solo bajadas
        </button>
        <div className="flex overflow-hidden rounded-lg border border-line">
          <button
            type="button"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
            className="px-2.5 py-1.5 text-sm text-ink-mut outline-none focus-visible:outline-2 focus-visible:outline-accent aria-pressed:bg-accent-soft aria-pressed:text-accent"
          >
            Lista
          </button>
          <button
            type="button"
            aria-pressed={view === 'photos'}
            onClick={() => setView('photos')}
            className="px-2.5 py-1.5 text-sm text-ink-mut outline-none focus-visible:outline-2 focus-visible:outline-accent aria-pressed:bg-accent-soft aria-pressed:text-accent"
          >
            Fotos
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="mt-4 text-center text-ink-mut">
          {onlyFavs && !searching && !onlyDrops
            ? 'Aún no hay favoritos aquí. Toca la ★ de la foto de un artículo para marcarlo.'
            : 'Nada que coincida.'}
        </p>
      ) : groupByFolder ? (
        groups.map(([key, groupItems]) => {
          const name = folderGroupName(key, foldersById)
          const total = itemsTotal(groupItems)
          const open = searching || !collapsed.has(key)
          return (
            <section key={key} className="flex flex-col gap-2">
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-mut">
                <button
                  type="button"
                  onClick={() => toggleGroup(key)}
                  disabled={searching}
                  aria-expanded={open}
                  title={open ? 'Contraer' : 'Expandir'}
                  className="flex min-w-0 items-baseline gap-2 rounded text-left uppercase outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:hover:text-ink-mut"
                >
                  <IconChevronRight
                    className={`h-3.5 w-3.5 flex-none self-center transition-transform ${open ? 'rotate-90' : ''}`}
                  />
                  <span className="truncate">{name}</span>
                  <b className="flex-none font-mono font-normal normal-case tracking-normal">
                    {groupItems.length} · {formatPrice(total)}
                  </b>
                </button>
                <span className="h-px flex-1 bg-line" />
                <GroupCopyButton name={name} items={groupItems} />
              </h2>
              {open && itemsView(groupItems)}
            </section>
          )
        })
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-mut">
            {folderName && (
              <span className="flex min-w-0 items-center gap-1.5 text-ink">
                <IconCarpeta className="h-3.5 w-3.5 flex-none" />
                <span className="truncate">{folderName}</span>
              </span>
            )}
            <b className="flex-none font-mono font-normal normal-case tracking-normal">
              {sorted.length} artículo{sorted.length === 1 ? '' : 's'} · {formatPrice(itemsTotal(sorted))}
            </b>
            <span className="h-px flex-1 bg-line" />
            {onShowAll && (
              <button
                type="button"
                onClick={onShowAll}
                className="flex-none rounded-full border border-line px-2.5 py-1 text-[11px] font-medium normal-case tracking-normal text-ink-mut outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
              >
                Ver todos
              </button>
            )}
          </div>
          {itemsView(sorted)}
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
