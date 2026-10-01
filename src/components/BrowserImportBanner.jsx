import { useEffect, useRef, useState } from 'react'
import { formatPrice } from '../lib/format.js'

/** Lo que manda el botón del navegador (src/lib/browserImport.js). Con
 * `autoSave` (botón creado en este navegador, clave correcta) se guarda al
 * abrir; si no, espera a «Guardar»: los datos llegan en una URL que
 * cualquiera podría haber escrito. */
export default function BrowserImportBanner({ data, autoSave = false, onSave, onClose }) {
  const [status, setStatus] = useState(autoSave ? 'saving' : 'idle') // idle | saving | done | error
  const [message, setMessage] = useState('')
  // StrictMode repite los efectos en desarrollo: sin esto se guardaría dos veces.
  const started = useRef(false)

  useEffect(() => {
    if (!autoSave || started.current) return
    started.current = true
    handleSave()
  }, [autoSave])

  async function handleSave() {
    setStatus('saving')
    const result = await onSave(data)
    if (result.error) {
      setStatus('error')
      setMessage(result.error)
      return
    }
    setStatus('done')
    let text
    if (!result.updated) text = 'Guardado en tu lista.'
    else if (result.previousPrice != null && result.previousPrice !== data.price)
      text = `Ya lo tenías: precio actualizado de ${formatPrice(result.previousPrice)} a ${formatPrice(data.price)}.`
    else text = 'Ya lo tenías: precio apuntado, sin cambios.'
    if (result.manual) text += ' Esta tienda no tiene precio automático: para actualizarlo, vuelve a pulsar «Guardar en Vigía» en su ficha.'
    setMessage(text)
  }

  return (
    <div role="status" className="mb-2 flex items-center gap-3 rounded-lg border border-accent bg-accent-soft p-3 text-sm">
      {data.image && (
        <img src={data.image} alt="" className="h-12 w-12 flex-none rounded border border-line bg-surface object-contain" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-xs text-ink-mut">Desde tu navegador · {new URL(data.url).hostname.replace(/^www\./, '')}</span>
        <span className="truncate font-medium">{data.title}</span>
        <span className="font-mono font-semibold tabular-nums">
          {formatPrice(data.price)}
          {data.inStock === false && <span className="ml-2 font-sans text-xs font-normal text-warn">sin stock</span>}
        </span>
        {(status === 'done' || status === 'error') && (
          <span className={status === 'error' ? 'text-bad' : 'text-ink-mut'}>{message}</span>
        )}
      </div>
      <div className="flex flex-none flex-col gap-1.5 sm:flex-row">
        {status !== 'done' && (
          <button
            type="button"
            onClick={handleSave}
            disabled={status === 'saving'}
            className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
          >
            {status === 'saving' ? 'Guardando…' : 'Guardar'}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 outline-none focus-visible:outline-2 focus-visible:outline-accent"
        >
          {status === 'done' ? 'Cerrar' : 'Descartar'}
        </button>
      </div>
    </div>
  )
}
