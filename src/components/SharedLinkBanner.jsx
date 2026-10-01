import { useEffect, useRef, useState } from 'react'
import { formatPrice } from '../lib/format.js'

/** Resultado de compartir un enlace a Vigía desde Android (src/lib/shareTarget.js).
 * Se guarda solo, sin preguntar, y se ofrece «Deshacer»: la dirección llega
 * en una URL que otra persona podría fabricar, y así un enlace así no deja
 * nada en la lista sin que se vea. */
export default function SharedLinkBanner({ url, onSave, onUndo, onClose }) {
  const [status, setStatus] = useState('saving') // saving | done | error | undone
  const [result, setResult] = useState(null)
  // StrictMode repite los efectos en desarrollo: sin esto se guardaría dos veces.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    onSave(url).then((res) => {
      setResult(res)
      setStatus(res.error ? 'error' : 'done')
    })
  }, [url, onSave])

  async function undo() {
    const res = await onUndo(result.item.itm_id)
    if (!res.error) setStatus('undone')
  }

  const host = new URL(url).hostname.replace(/^www\./, '')
  let text
  if (status === 'saving') text = `Guardando desde ${host}…`
  else if (status === 'error') text = result.error
  else if (status === 'undone') text = 'Deshecho: no se ha guardado nada.'
  else if (result.manual)
    text = `Guardado sin precio: ${host} no deja leerlo desde aquí. El Chrome de tu ordenador se lo pondrá en el próximo pase.`
  else text = `Guardado: ${result.item.itm_title} · ${formatPrice(result.item.itm_price)}`

  return (
    <div
      role="status"
      className={`mb-2 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
        status === 'error' ? 'border-line bg-surface text-bad' : 'border-accent bg-accent-soft'
      }`}
    >
      <span className="min-w-0">{text}</span>
      <div className="flex flex-none gap-1.5">
        {status === 'done' && (
          <button
            type="button"
            onClick={undo}
            className="rounded-lg border border-line bg-surface px-2.5 py-1 outline-none focus-visible:outline-2 focus-visible:outline-accent"
          >
            Deshacer
          </button>
        )}
        {status !== 'saving' && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar aviso"
            className="rounded px-1.5 text-ink-mut outline-none focus-visible:outline-2 focus-visible:outline-accent"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}
