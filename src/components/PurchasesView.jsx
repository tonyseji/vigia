import { useMemo, useState } from 'react'
import { formatPrice, formatDay } from '../lib/format.js'
import {
  purchasesTotal,
  purchasesInFolder,
  groupPurchasesByFolder,
  purchaseYears,
  purchasesInYear,
  paidVsLowest,
} from '../lib/purchases.js'
import { ProductIcon, IconRecibo } from './icons/index.jsx'
import PurchaseFormModal from './PurchaseFormModal.jsx'
import { ConfirmDialog } from './Dialog.jsx'

/** Fecha de hoy en local como YYYY-MM-DD (toISOString daría la de UTC). */
export function todayLocal(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** El mínimo histórico del artículo: el campo si viene, o el más bajo de su
 * histórico cargado. */
function withMinPrice(item) {
  if (!item || item.itm_min_price != null) return item
  const prices = (item.price_history ?? []).map((h) => h.ph_price).filter((p) => p != null)
  return prices.length ? { ...item, itm_min_price: Math.min(...prices) } : item
}

function draftOf(p) {
  return { title: p.pur_title, amount: p.pur_amount, date: p.pur_date, store: p.pur_store, notes: p.pur_notes, folderId: p.pur_fld_id }
}

const btn =
  'rounded-lg border border-line px-2.5 py-1 text-xs text-ink-mut outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-accent'

/** Vista «Compras»: lo gastado, filtrado por la carpeta elegida en la barra
 * (y sus subcarpetas) y por año. */
export default function PurchasesView({
  purchases,
  loading,
  loadFailed,
  folders,
  selectedFolderId,
  folderName,
  itemsById,
  onAdd,
  onUpdate,
  onDelete,
}) {
  const [year, setYear] = useState(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [notice, setNotice] = useState('')

  const inFolder = useMemo(() => purchasesInFolder(purchases, selectedFolderId, folders), [purchases, selectedFolderId, folders])
  const years = useMemo(() => purchaseYears(inFolder), [inFolder])
  const activeYear = year != null && years.includes(year) ? year : null
  const shown = useMemo(() => purchasesInYear(inFolder, activeYear), [inFolder, activeYear])
  const groups = useMemo(() => groupPurchasesByFolder(shown, folders), [shown, folders])
  const total = purchasesTotal(shown)

  async function handleDelete(p) {
    const result = await onDelete(p.pur_id)
    setNotice(result?.error ?? '')
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[60px] animate-pulse rounded-lg border border-line bg-surface-2" />
        ))}
      </div>
    )
  }

  // Si la lectura falló, el aviso de arriba ya lo dice: no parecer vacío.
  if (purchases.length === 0 && loadFailed) return null

  const addButton = (
    <button
      type="button"
      onClick={() => setAdding(true)}
      className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      + Añadir compra
    </button>
  )

  return (
    <div className="flex flex-col gap-4">
      {notice && (
        <p role="alert" className="rounded-lg border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">
          {notice}
        </p>
      )}

      {purchases.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 text-center text-ink-mut">
          <IconRecibo className="h-8 w-8 opacity-70" />
          <p className="max-w-xs">
            Aún no has registrado compras. Anota lo que gastas, o pulsa «Comprado» en un artículo vigilado, para ver
            cuánto llevas gastado en cada cosa.
          </p>
          {addButton}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-line bg-surface p-3">
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold uppercase tracking-wide text-ink-mut">
                {folderName ? `Gastado en ${folderName}` : 'Total gastado'}
                {activeYear != null ? ` · ${activeYear}` : ''}
              </div>
              <div className="font-mono text-2xl font-semibold tabular-nums">{formatPrice(total)}</div>
              <div className="text-xs text-ink-mut">
                {shown.length} compra{shown.length === 1 ? '' : 's'}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {years.length > 0 && (
                <select
                  value={activeYear ?? ''}
                  onChange={(e) => setYear(e.target.value ? Number(e.target.value) : null)}
                  aria-label="Año"
                  className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <option value="">Todos los años</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              )}
              {addButton}
            </div>
          </div>

          {shown.length === 0 ? (
            <p className="mt-2 text-center text-ink-mut">
              No hay compras {folderName ? 'en esta carpeta' : ''}
              {activeYear != null ? ` en ${activeYear}` : ''}.
            </p>
          ) : (
            groups.map((group) => (
              <section key={group.key} className="flex flex-col gap-2">
                <h2 className="flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wide text-ink-mut">
                  <span className="truncate">{group.name}</span>
                  <b className="flex-none font-mono font-normal normal-case tracking-normal">
                    {group.purchases.length} · {formatPrice(group.total)}
                  </b>
                  <span className="h-px flex-1 self-center bg-line" />
                </h2>
                <div className="flex flex-col gap-2">
                  {group.purchases.map((p) => (
                    <PurchaseRow
                      key={p.pur_id}
                      purchase={p}
                      item={p.pur_itm_id ? withMinPrice(itemsById[p.pur_itm_id]) : null}
                      onEdit={() => setEditing(p)}
                      onDelete={() => setDeleting(p)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </>
      )}

      {adding && (
        <PurchaseFormModal
          heading="Añadir compra"
          draft={{ date: todayLocal(), folderId: selectedFolderId }}
          folders={folders}
          onSave={onAdd}
          onClose={() => setAdding(false)}
        />
      )}
      {editing && (
        <PurchaseFormModal
          heading="Editar compra"
          draft={draftOf(editing)}
          folders={folders}
          onSave={(fields) => onUpdate(editing.pur_id, fields)}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="¿Borrar esta compra?"
          text={
            deleting.pur_itm_id
              ? `«${deleting.pur_title}» (${formatPrice(deleting.pur_amount)}). El artículo volverá a vigilarse.`
              : `«${deleting.pur_title}» (${formatPrice(deleting.pur_amount)}). No se puede deshacer.`
          }
          confirmLabel="Borrar"
          onConfirm={() => handleDelete(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  )
}

function PurchaseRow({ purchase: p, item, onEdit, onDelete }) {
  const diff = item ? paidVsLowest(p, item) : null
  return (
    <article className="flex items-center gap-3 rounded-lg border border-line bg-surface p-2.5">
      {item && (
        <div
          className={`grid h-12 w-12 flex-none place-items-center overflow-hidden rounded-md border border-line ${item.itm_image_url ? 'bg-photo p-1' : 'bg-surface-2'}`}
        >
          {item.itm_image_url ? (
            <img src={item.itm_image_url} alt="" className="h-full w-full object-contain mix-blend-multiply" />
          ) : (
            <ProductIcon kind={item.itm_icon} className="h-5 w-5 text-ink-mut opacity-85" />
          )}
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="line-clamp-2 text-[14.5px] font-medium">{p.pur_title}</span>
        <span className="text-xs text-ink-mut">
          {formatDay(`${p.pur_date}T12:00:00`)}
          {p.pur_store ? ` · ${p.pur_store}` : ''}
        </span>
        {diff != null && (
          <span className={`text-xs ${diff > 0 ? 'text-bad' : 'text-ok'}`}>
            {diff === 0
              ? 'Pagaste justo el mínimo'
              : `Pagaste ${formatPrice(Math.abs(diff))} ${diff > 0 ? 'más' : 'menos'} que el mínimo`}
          </span>
        )}
        {p.pur_notes && <span className="line-clamp-2 text-xs text-ink-mut">{p.pur_notes}</span>}
      </div>
      <div className="flex flex-none flex-col items-end gap-1.5">
        <span className="font-mono text-[16px] font-semibold tabular-nums">{formatPrice(p.pur_amount)}</span>
        <div className="flex gap-1.5">
          <button type="button" onClick={onEdit} className={btn}>
            Editar
          </button>
          <button type="button" onClick={onDelete} className={`${btn} hover:text-bad`}>
            Borrar
          </button>
        </div>
      </div>
    </article>
  )
}
