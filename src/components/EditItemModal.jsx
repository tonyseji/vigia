import { useState } from 'react'
import { displayTitle } from '../lib/itemText.js'
import Dialog, { ConfirmDialog } from './Dialog.jsx'

/** Modal simple para editar título, notas, carpeta y precio manual, o borrar
 * el artículo. Sin librería de diálogos: Dialog propio. */
export default function EditItemModal({ item, folders, onSave, onDelete, onClose }) {
  // Sin nombre todavía (título = dirección, ver src/lib/itemText.js): campo
  // vacío con el nombre sugerido de muestra, para no guardar la dirección
  // como si fuera un nombre escrito a mano.
  const untitled = !item.itm_title || item.itm_title === item.itm_url
  const [title, setTitle] = useState(untitled ? '' : item.itm_title)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [notes, setNotes] = useState(item.itm_notes ?? '')
  const [price, setPrice] = useState(item.itm_price != null ? String(item.itm_price) : '')
  const [folderId, setFolderId] = useState(item.itm_fld_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const changes = { itm_title: title.trim() || (untitled ? item.itm_url : item.itm_title), itm_notes: notes.trim() || null, itm_fld_id: folderId || null }
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
    setSaving(true)
    const result = await onDelete()
    setSaving(false)
    if (result?.error) setError(result.error)
  }

  return (
    <Dialog title="Editar artículo" onClose={onClose} as="form" onSubmit={handleSave} className="max-w-sm gap-3">
      <label className="flex flex-col gap-1 text-sm text-ink-mut">
        Título
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={untitled ? displayTitle(item) : undefined}
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
          onClick={() => setConfirmingDelete(true)}
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
      {confirmingDelete && (
        <ConfirmDialog
          title="¿Eliminar este artículo?"
          text={`«${displayTitle(item)}» y todo su histórico de precios. No se puede deshacer.`}
          confirmLabel="Eliminar"
          onConfirm={handleDelete}
          onClose={() => setConfirmingDelete(false)}
        />
      )}
    </Dialog>
  )
}
