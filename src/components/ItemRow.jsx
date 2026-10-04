import { useEffect, useRef, useState } from 'react'
import { MANUAL_HINT, BROWSER_HINT, manualPriceStatus } from '../lib/browserImport.js'
import { formatPrice, formatPct, priceChangePct, showPct } from '../lib/format.js'
import { itemToText, copyToClipboard } from '../lib/clipboard.js'
import { displayTitle } from '../lib/itemText.js'
import { ProductIcon, IconCopiar, IconCheck, IconEtiqueta } from './icons/index.jsx'
import Sparkline from './Sparkline.jsx'
import EditItemModal from './EditItemModal.jsx'

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Fila densa de un artículo (docs/DISENO.md): franja lateral de color,
 * miniatura, nombre + tienda, minigráfico si hay histórico, precio y
 * variación, o la píldora ámbar de "sin precio" cuando corresponde.
 * El botón de editar (✎) abre EditItemModal, que también permite borrar. */
export default function ItemRow({ item, folders, onUpdate, onDelete, picking, inBasket, onToggleBasket, justAdded }) {
  const [editing, setEditing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [movingFolder, setMovingFolder] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef(null)
  const currentFolder = folders?.find((f) => f.fld_id === item.itm_fld_id)

  useEffect(() => {
    if (!pickerOpen) return
    // capture, pero solo cierra si el click fue fuera del picker: si no, un
    // click en una carpeta de la lista nunca llega a su botón porque el
    // picker se desmonta antes de que React dispare ese onClick.
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
  const manualStatus = manualPriceStatus(item)
  const title = displayTitle(item)
  const state = item.itm_price == null ? 'n' : pct < 0 ? 'd' : pct > 0 ? 'u' : ''
  const stripeColor = state === 'd' ? 'var(--color-ok)' : state === 'u' ? 'var(--color-bad)' : state === 'n' ? 'var(--color-warn)' : 'transparent'

  return (
    <article
      data-item-id={item.itm_id}
      className={`relative flex flex-wrap items-stretch gap-x-3 gap-y-2.5 rounded-lg border p-2.5 pl-3 lg:flex-nowrap ${picking && inBasket ? 'border-accent bg-accent-soft' : 'border-line bg-surface'} ${justAdded ? 'just-added' : ''}`}
    >
      <div className="absolute inset-y-0 left-0 w-[3px] rounded-l-lg" style={{ background: stripeColor }} />

      {picking && (
        <label className="order-0 flex flex-none cursor-pointer items-center self-center pl-0.5">
          <input
            type="checkbox"
            checked={inBasket}
            onChange={() => onToggleBasket(item.itm_id)}
            aria-label={`Meter ${title} en la cesta`}
            className="h-4 w-4 cursor-pointer accent-accent"
          />
        </label>
      )}

      <div
        className={`order-1 grid h-17 w-17 flex-none place-items-center self-center overflow-hidden rounded-md border border-line ${item.itm_image_url ? 'bg-photo p-1' : 'bg-surface-2'}`}
      >
        {item.itm_image_url ? (
          // multiply: el fondo blanco de la foto de la tienda se funde con la
          // caja, así todas las miniaturas se ven del mismo tamaño.
          <img
            src={item.itm_image_url}
            alt=""
            className="h-full w-full object-contain mix-blend-multiply"
          />
        ) : (
          <ProductIcon kind={item.itm_icon} className="h-7 w-7 text-ink-mut opacity-85" />
        )}
      </div>

      {/* Por debajo de lg: foto y nombre en la primera línea, precio y
          acciones en la segunda. La base deja justo el hueco de la foto (y de
          la casilla de la cesta), así el precio no se cuela arriba. */}
      <div
        className={`order-2 flex min-w-0 flex-1 flex-col justify-center gap-0.5 lg:basis-0 ${picking ? 'basis-[calc(100%-112px)]' : 'basis-[calc(100%-80px)]'}`}
      >
        <a
          href={item.itm_url}
          target="_blank"
          rel="noreferrer"
          className="line-clamp-2 text-[14.5px] font-medium text-ink outline-none focus-visible:outline-2 focus-visible:outline-accent"
        >
          {title}
        </a>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-mut">
          {/* Cada «· dato» va junto: si la línea se parte, el separador
              arranca la siguiente en vez de quedarse colgando. */}
          <span className="font-medium">{domainOf(item.itm_url)}</span>
          <span className="whitespace-nowrap">
            · {item.price_history.length} {item.price_history.length === 1 ? 'registro' : 'registros'}
          </span>
          {manualStatus === 'browser' && (
            <span className="whitespace-nowrap" title={BROWSER_HINT}>
              · precio desde Chrome
            </span>
          )}
          {manualStatus && manualStatus !== 'browser' && (
            <span className="whitespace-nowrap text-warn" title={MANUAL_HINT}>
              <span className="text-ink-mut">·</span> sin precio automático
            </span>
          )}
        </div>
      </div>

      {/* El hueco del minigráfico se reserva aunque no haya histórico: si no,
          el precio cambia de columna de una fila a otra. */}
      <div className="order-4 hidden w-[74px] flex-none items-center lg:flex">
        {history.length > 1 && <Sparkline values={history} direction={pct ?? 0} />}
      </div>

      <div className="order-3 flex min-w-[104px] flex-1 flex-col items-end justify-center gap-1 lg:w-[132px] lg:flex-none">
        {item.itm_price == null ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md bg-warn-soft px-1.5 py-1 text-[11.5px] text-warn outline-none focus-visible:outline-2 focus-visible:outline-accent"
          >
            Sin precio · edítalo
          </button>
        ) : (
          <>
            <span className="font-mono text-[17px] font-semibold tabular-nums">{formatPrice(item.itm_price)}</span>
            {/* Variación y precio anterior en una sola línea: con el tachado
                debajo, las filas con bajada quedaban más altas que el resto. */}
            {showPct(pct) && (
              <div className="flex items-center gap-1.5">
                {pct < 0 && reference != null && (
                  <span className="font-mono text-[11px] text-ink-mut line-through">{formatPrice(reference)}</span>
                )}
                <span
                  className="rounded-md px-1.5 py-0.5 font-mono text-[11.5px] tabular-nums"
                  style={{
                    background: pct < 0 ? 'var(--color-ok-soft)' : 'var(--color-bad-soft)',
                    color: pct < 0 ? 'var(--color-ok)' : 'var(--color-bad)',
                  }}
                >
                  {formatPct(pct)}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="order-3 relative flex-none self-center">
        <button
          type="button"
          disabled={movingFolder}
          onClick={(e) => {
            e.stopPropagation()
            setPickerOpen((v) => !v)
          }}
          title={currentFolder ? currentFolder.fld_name : 'Sin carpeta'}
          className="flex w-[92px] items-center gap-1 rounded-md border border-line px-1.5 py-1.5 text-[11px] text-ink-mut outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
        >
          <IconEtiqueta className="h-3.5 w-3.5 flex-none" />
          <span className="truncate">{currentFolder ? currentFolder.fld_name : 'Sin carpeta'}</span>
        </button>

        {pickerOpen && (
          <div
            ref={pickerRef}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-8 z-10 flex max-h-56 w-44 flex-col gap-0.5 overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-lg"
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

      <button
        type="button"
        onClick={async () => {
          const ok = await copyToClipboard(itemToText(item))
          if (ok) {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }
        }}
        aria-label="Copiar para Claude"
        title="Copiar para Claude"
        className="order-3 flex-none self-center rounded-md border border-line p-1.5 text-ink-mut outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
      >
        {copied ? <IconCheck className="h-4 w-4 text-ok" /> : <IconCopiar className="h-4 w-4" />}
      </button>

      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Editar artículo"
        title="Editar"
        className="order-3 flex-none self-center rounded-md border border-line p-1.5 text-ink-mut outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>

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
