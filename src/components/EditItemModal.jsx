import { useState } from 'react'

/** Modal simple para editar título, notas, carpeta y precio manual, o borrar
 * el artículo. Sin librería de diálogos: <dialog> nativo. */
export default function EditItemModal({ item, folders, onSave, onDelete, onClose }) {
  const [title, setTitle] = useState(item.itm_title ?? '')
  const [notes, setNotes] = useState(item.itm_notes ?? '')
  const [price, setPrice] = useState(item.itm_price != null ? String(item.itm_price) : '')
  const [folderId, setFolderId] = useState(item.itm_fld_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const changes = { itm_title: title.trim(), itm_notes: notes.trim() || null, itm_fld_id: folderId || null }
    const trimmedPrice = price.trim()
    if (trimmedPrice) {
      const parsed = Number(trimmedPrice.replace(',', '.'))
      if (!Number.isNaN(parsed) && parsed > 0) changes.price = parsed
    }
    const result = await onSave(changes)
    setSaving(false)
    if (result?.error) {
      setError(result.error)
      return
    }
    onClose()
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar "${item.itm_title}"?`)) return
    setSaving(true)
    const result = await onDelete()
    setSaving(false)
    if (result?.error) setError(result.error)
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <form
        onSubmit={handleSave}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-sm flex-col gap-3 rounded-lg border border-line bg-surface p-4"
      >
        <h3 className="font-display text-lg font-bold">Editar artículo</h3>

        <label className="flex flex-col gap-1 text-sm text-ink-mut">
          Título
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-ink outline-none focus-visible:outline-2 focus-visible:outline-accent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-ink-mut">
          Precio actual (manual, €)
          <input
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Solo si quieres corregirlo a mano"
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-ink outline-none focus-visible:outline-2 focus-visible:outline-accent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-ink-mut">
          Carpeta
          <select
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-ink outline-none focus-visible:outline-2 focus-visible:outline-accent"
          >
            <option value="">Sin carpeta</option>
            {folders?.map((f) => (
              <option key={f.fld_id} value={f.fld_id}>
                {f.fld_parent_id ? `  ↳ ${f.fld_name}` : f.fld_name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-ink-mut">
          Notas
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-ink outline-none focus-visible:outline-2 focus-visible:outline-accent"
          />
        </label>

        {error && (
          <p className="text-sm text-bad" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="rounded-lg border border-bad px-3 py-1.5 text-sm text-bad outline-none focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
          >
            Eliminar
          </button>
          <div className="flex gap-2">
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
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
