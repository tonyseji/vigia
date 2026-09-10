import { useEffect, useRef, useState } from 'react'
import { formatPrice, formatPct, priceChangePct } from '../lib/format.js'
import { ProductIcon, IconEtiqueta } from './icons/index.jsx'
import EditItemModal from './EditItemModal.jsx'

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Tarjeta de artículo para la vista Fotos (docs/DISENO.md): imagen grande
 * sin recortar, franja de color arriba, nombre + tienda, precio y
 * variación. Vista secundaria para comparar diseños, no precios: sin
 * minigráfico ni copiar para Claude, pero sí carpeta y editar — sin ellos
 * un artículo añadido en esta vista no se podía organizar (feedback de
 * Tony tras ver la vista Fotos en producción, sesión 15). */
export default function ItemTile({ item, folders, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [movingFolder, setMovingFolder] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef(null)
  const currentFolder = folders?.find((f) => f.fld_id === item.itm_fld_id)

  useEffect(() => {
    if (!pickerOpen) return
    const close = (e) => {
      if (pickerRef.current && pickerRef.current.contains(e.target)) return
      setPickerOpen(false)
    }
    document.addEventListener('click', close, true)
    return () => document.removeEventListener('click', close, true)
  }, [pickerOpen])

  async function moveTo(folderId) {
    setPickerOpen(false)
    setMovingFolder(true)
    await onUpdate(item.itm_id, { itm_fld_id: folderId })
    setMovingFolder(false)
  }

  const history = item.price_history.map((h) => h.ph_price).filter((p) => p != null)
  const reference = history.length > 1 ? history[0] : null
  const pct = item.itm_price != null && reference != null ? priceChangePct(item.itm_price, reference) : null
  const state = item.itm_price == null ? 'n' : pct < 0 ? 'd' : pct > 0 ? 'u' : ''
  const stripeColor = state === 'd' ? 'var(--color-ok)' : state === 'u' ? 'var(--color-bad)' : state === 'n' ? 'var(--color-warn)' : 'transparent'

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
      <div className="relative aspect-4/3 grid place-items-center bg-surface-2">
        <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: stripeColor }} />
        {item.itm_image_url ? (
          <img src={item.itm_image_url} alt="" className="h-full w-full object-contain" />
        ) : (
          <ProductIcon kind={item.itm_icon} className="h-9 w-9 text-ink-mut opacity-80" />
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Editar artículo"
          title="Editar"
          className="absolute right-1.5 top-1.5 rounded-md border border-line bg-surface/90 p-1.5 text-ink-mut outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-0.5 p-2.5">
        <a
          href={item.itm_url}
          target="_blank"
          rel="noreferrer"
          className="line-clamp-2 text-[13px] font-medium text-ink outline-none focus-visible:outline-2 focus-visible:outline-accent"
        >
          {item.itm_title}
        </a>
        <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[11px] text-ink-mut">
          <span className="truncate">{domainOf(item.itm_url)}</span>
          {item.itm_is_manual && (
            <>
              <span>·</span>
              <span className="text-warn">bloquea la lectura</span>
            </>
          )}
        </div>

        <div className="mt-auto flex items-end justify-between gap-1.5 pt-1">
          {item.itm_price == null ? (
            <span className="rounded-md bg-warn-soft px-1.5 py-0.5 text-[10.5px] text-warn">Sin precio</span>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[14.5px] font-semibold tabular-nums">{formatPrice(item.itm_price)}</span>
              {pct != null && (
                <span
                  className="w-fit rounded-md px-1.5 py-0.5 font-mono text-[10.5px] tabular-nums"
                  style={{
                    background: pct < 0 ? 'var(--color-ok-soft)' : 'var(--color-bad-soft)',
                    color: pct < 0 ? 'var(--color-ok)' : 'var(--color-bad)',
                  }}
                >
                  {formatPct(pct)}
                </span>
              )}
            </div>
          )}

          <div className="relative flex-none">
            <button
              type="button"
              disabled={movingFolder}
              onClick={(e) => {
                e.stopPropagation()
                setPickerOpen((v) => !v)
              }}
              title={currentFolder ? currentFolder.fld_name : 'Sin carpeta'}
              className="flex max-w-[76px] items-center gap-1 rounded-md border border-line px-1.5 py-1 text-[10.5px] text-ink-mut outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
            >
              <IconEtiqueta className="h-3 w-3 flex-none" />
              <span className="truncate">{currentFolder ? currentFolder.fld_name : 'Sin carpeta'}</span>
            </button>

            {pickerOpen && (
              <div
                ref={pickerRef}
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-8 left-1/2 z-10 flex max-h-56 w-40 -translate-x-1/2 flex-col gap-0.5 overflow-y-auto rounded-lg border border-line bg-surface p-1 text-sm shadow-lg"
              >
                <button
                  type="button"
                  onClick={() => moveTo(null)}
                  className={`rounded-md px-2 py-1.5 text-left text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent ${item.itm_fld_id == null ? 'bg-accent-soft text-ink' : 'text-ink hover:bg-surface-2'}`}
                >
                  Sin carpeta
                </button>
                {folders?.map((f) => (
                  <button
                    key={f.fld_id}
                    type="button"
                    onClick={() => moveTo(f.fld_id)}
                    className={`truncate rounded-md px-2 py-1.5 text-left text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent ${item.itm_fld_id === f.fld_id ? 'bg-accent-soft text-ink' : 'text-ink hover:bg-surface-2'}`}
                    style={{ paddingLeft: f.fld_parent_id ? '1.5rem' : '0.5rem' }}
                  >
                    {f.fld_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <EditItemModal
          item={item}
          folders={folders}
          onSave={(changes) => onUpdate(item.itm_id, changes)}
          onDelete={() => onDelete(item.itm_id)}
          onClose={() => setEditing(false)}
        />
      )}
    </article>
  )
}
