import { useState } from 'react'
import Dialog from './Dialog.jsx'

const inputClass =
  'rounded-lg border border-line bg-surface px-3 py-1.5 text-ink outline-none focus-visible:outline-2 focus-visible:outline-accent'

/** Importe escrito a mano: acepta coma o punto decimal ("1.299,50" también).
 * Devuelve null si no es un número ≥ 0. */
export function parseAmount(text) {
  const raw = String(text ?? '').trim().replace(/\s|€/g, '')
  if (!raw) return null
  // Con coma, los puntos son separadores de miles; sin coma, el punto es decimal.
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null
  return Math.round(Number(normalized) * 100) / 100
}

/** Alta y edición de una compra; también el «Comprado» de un artículo
 * (viene precargado con purchaseDraftFromItem). `draft` = { title, amount,
 * date, store, notes, folderId }. `folders` ya viene en orden de árbol con
 * `depth`. `onSave(fields)` devuelve {} o { error }. */
export default function PurchaseFormModal({ heading, draft, folders, onSave, onClose, submitLabel = 'Guardar' }) {
  const [title, setTitle] = useState(draft.title ?? '')
  const [amount, setAmount] = useState(draft.amount != null ? String(draft.amount).replace('.', ',') : '')
  const [date, setDate] = useState(draft.date ?? '')
  const [store, setStore] = useState(draft.store ?? '')
  const [notes, setNotes] = useState(draft.notes ?? '')
  const [folderId, setFolderId] = useState(draft.folderId ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return setError('Escribe qué has comprado.')
    const parsed = parseAmount(amount)
    if (parsed == null) return setError('El importe no es válido. Ejemplo: 129,90')
    if (!date) return setError('Elige la fecha de la compra.')
    setSaving(true)
    setError('')
    const result = await onSave({
      title: title.trim(),
      amount: parsed,
      date,
      store: store.trim() || null,
      notes: notes.trim() || null,
      folderId: folderId || null,
    })
    setSaving(false)
    if (result?.error) return setError(result.error)
    onClose()
  }

  return (
    <Dialog title={heading} onClose={onClose} as="form" onSubmit={handleSubmit} className="max-h-full max-w-sm gap-3 overflow-y-auto">
      <label className="flex flex-col gap-1 text-sm text-ink-mut">
        Qué has comprado
        <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus className={inputClass} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex min-w-0 flex-col gap-1 text-sm text-ink-mut">
          Importe (€)
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            className={`${inputClass} min-w-0 font-mono`}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm text-ink-mut">
          Fecha
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} min-w-0`} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm text-ink-mut">
        Tienda
        <input value={store} onChange={(e) => setStore(e.target.value)} placeholder="Opcional" className={inputClass} />
      </label>

      <label className="flex flex-col gap-1 text-sm text-ink-mut">
        Carpeta
        <select value={folderId} onChange={(e) => setFolderId(e.target.value)} className={inputClass}>
          <option value="">Sin carpeta (privada)</option>
          {folders?.map((f) => (
            <option key={f.fld_id} value={f.fld_id}>
              {f.depth ? `${' '.repeat(3 * f.depth - 1)}↳ ${f.fld_name}` : f.fld_name}
            </option>
          ))}
        </select>
        <span className="text-xs">Una carpeta compartida comparte también sus compras.</span>
      </label>

      <label className="flex flex-col gap-1 text-sm text-ink-mut">
        Nota
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
      </label>

      {error && (
        <p className="text-sm text-bad" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
        >
          {saving ? 'Guardando…' : submitLabel}
        </button>
      </div>
    </Dialog>
  )
}
