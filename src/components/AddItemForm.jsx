import { useEffect, useState } from 'react'
import { findUrlInText, readTypedUrl } from '../lib/shareTarget.js'
import { formatPrice } from '../lib/format.js'
import { displayTitle } from '../lib/itemText.js'

// «Pegar» solo en el móvil (sm:hidden) y si el navegador deja leer el
// portapapeles: en el iPhone es la vía sin configurar nada (Compartir →
// Copiar en la tienda, y aquí un toque). Safari enseña su propia burbuja
// «Pegar» antes de dar el texto.
const canPaste = typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function'

/** Barra de añadir URL, con los tres estados de docs/DISENO.md: añadiendo,
 * error en palabras llanas sin perder la URL, y el aviso de tienda
 * bloqueada con la opción de guardar en modo manual. */
export default function AddItemForm({ onAdd, onAddManual, folderId = null }) {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState('idle') // idle | adding | error | blocked
  const [errorMsg, setErrorMsg] = useState('')
  const [manualPrice, setManualPrice] = useState('')
  // Lo último guardado, unos segundos: confirma qué ha entrado y avisa si
  // no se encontró el precio (antes se guardaba en silencio).
  const [saved, setSaved] = useState(null)

  useEffect(() => {
    if (!saved) return
    const timer = setTimeout(() => setSaved(null), 7000)
    return () => clearTimeout(timer)
  }, [saved])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!url.trim()) return
    // Acepta lo que pega la gente: la dirección, una frase que la lleva o
    // una dirección sin «https://» (el navegador rechazaba las dos últimas).
    const typed = readTypedUrl(url)
    if (!typed) {
      setStatus('error')
      setErrorMsg('Eso no parece una dirección web. Copia la dirección de la ficha del producto y pégala aquí.')
      return
    }
    setUrl(typed)
    await add(typed)
  }

  async function add(value) {
    setStatus('adding')
    setErrorMsg('')
    setSaved(null)
    const result = await onAdd(value, folderId)
    if (result.blocked) {
      setStatus('blocked')
      return
    }
    if (result.error) {
      setStatus('error')
      setErrorMsg(result.error)
      return
    }
    setUrl('')
    setStatus('idle')
    if (result.item) setSaved(result.item)
  }

  /** Lee la dirección copiada y la guarda sin más toques. */
  async function handlePaste() {
    let text = ''
    try {
      text = await navigator.clipboard.readText()
    } catch {
      // Permiso denegado o burbuja cerrada sin pegar.
      return
    }
    const pasted = findUrlInText(text)
    if (!pasted) {
      setStatus('error')
      setErrorMsg('No hay ninguna dirección copiada. En la tienda: Compartir → Copiar, y vuelve a tocar «Pegar».')
      return
    }
    setUrl(pasted)
    await add(pasted)
  }

  async function handleManualSave() {
    const price = manualPrice.trim() ? Number(manualPrice.replace(',', '.')) : null
    const result = await onAddManual(url.trim(), price, folderId)
    if (result.error) {
      setStatus('error')
      setErrorMsg(result.error)
      return
    }
    setUrl('')
    setManualPrice('')
    setStatus('idle')
    if (result.item) setSaved(result.item)
  }

  if (status === 'blocked') {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3">
        <p className="text-sm text-warn">
          Esta tienda no deja leer el precio automáticamente. Puedes guardar el artículo igualmente e ir
          metiendo el precio a mano.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            placeholder="Precio actual (opcional)"
            value={manualPrice}
            onChange={(e) => setManualPrice(e.target.value)}
            className="w-40 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent"
          />
          <button
            type="button"
            onClick={handleManualSave}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Guardar igualmente
          </button>
          <button
            type="button"
            onClick={() => {
              setStatus('idle')
              setUrl('')
            }}
            className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent"
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="URL del producto"
          required
          placeholder="Pega aquí la URL de un producto"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            // Campo vaciado: el error era de la dirección que había, ya no aplica.
            if (!e.target.value && status === 'error') setStatus('idle')
          }}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 outline-none focus-visible:outline-2 focus-visible:outline-accent"
        />
        {canPaste && !url && (
          <button
            type="button"
            onClick={handlePaste}
            disabled={status === 'adding'}
            className="flex-none rounded-lg border border-accent bg-accent-soft px-3 py-2 font-semibold outline-none focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60 sm:hidden"
          >
            Pegar
          </button>
        )}
        <button
          type="submit"
          disabled={status === 'adding'}
          className="flex-none rounded-lg bg-accent px-4 py-2 font-semibold text-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
        >
          {status === 'adding' ? 'Leyendo…' : 'Añadir'}
        </button>
      </div>
      {status === 'error' && (
        <p className="text-sm text-bad" role="alert">
          {errorMsg}
        </p>
      )}
      {saved && status === 'idle' && (
        <p className="text-sm text-ink-mut" role="status">
          {saved.itm_price != null ? (
            <>
              <span className="text-ok">Guardado:</span> {displayTitle(saved)} ·{' '}
              <span className="font-mono tabular-nums text-ink">{formatPrice(saved.itm_price)}</span>
            </>
          ) : saved.itm_is_manual ? (
            <>
              <span className="text-ok">Guardado:</span> {displayTitle(saved)}. Pon el precio con ✎ cuando lo mires.
            </>
          ) : (
            <>
              <span className="text-warn">Guardado sin precio:</span> {displayTitle(saved)}. No lo encontré en la
              página; ponlo con ✎ cuando quieras.
            </>
          )}
        </p>
      )}
    </form>
  )
}
