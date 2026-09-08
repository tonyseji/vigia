import { useState } from 'react'

/** Barra de añadir URL, con los tres estados de docs/DISENO.md: añadiendo,
 * error en palabras llanas sin perder la URL, y el aviso de tienda
 * bloqueada con la opción de guardar en modo manual. */
export default function AddItemForm({ onAdd, onAddManual }) {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState('idle') // idle | adding | error | blocked
  const [errorMsg, setErrorMsg] = useState('')
  const [manualPrice, setManualPrice] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!url.trim()) return
    setStatus('adding')
    setErrorMsg('')
    const result = await onAdd(url.trim())
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
  }

  async function handleManualSave() {
    const price = manualPrice.trim() ? Number(manualPrice.replace(',', '.')) : null
    const result = await onAddManual(url.trim(), price)
    if (result.error) {
      setStatus('error')
      setErrorMsg(result.error)
      return
    }
    setUrl('')
    setManualPrice('')
    setStatus('idle')
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
          type="url"
          inputMode="url"
          required
          placeholder="Pega aquí la URL de un producto"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 outline-none focus-visible:outline-2 focus-visible:outline-accent"
        />
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
    </form>
  )
}
