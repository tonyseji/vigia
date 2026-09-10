import { useState } from 'react'

/** Compartir una carpeta de primer nivel: invitar por email y ver/revocar
 * las invitaciones activas. Mismo patrón visual que EditItemModal. */
export default function ShareFolderModal({ folder, shares, onInvite, onRevoke, onClose }) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function handleInvite(e) {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    setError('')
    const result = await onInvite(folder.fld_id, email.trim())
    setSending(false)
    if (result?.error) {
      setError(result.error)
      return
    }
    setEmail('')
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-sm flex-col gap-3 rounded-lg border border-line bg-surface p-4"
      >
        <h3 className="font-display text-lg font-bold">Compartir «{folder.fld_name}»</h3>
        <p className="text-sm text-ink-mut">
          La persona invitada verá y podrá editar esta carpeta, sus subcarpetas y los artículos dentro, igual que tú.
        </p>

        <form onSubmit={handleInvite} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pareja@email.com"
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent"
          />
          <button
            type="submit"
            disabled={sending}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
          >
            {sending ? 'Enviando…' : 'Invitar'}
          </button>
        </form>

        {error && (
          <p className="text-sm text-bad" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          {shares.length === 0 && <p className="text-sm text-ink-mut">Nadie tiene acceso todavía.</p>}
          {shares.map((share) => (
            <div key={share.shr_id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm">
              <span className="truncate">{share.shr_invited_email}</span>
              <span className="flex flex-none items-center gap-2">
                <span className="text-xs text-ink-mut">
                  {share.shr_status === 'accepted' ? 'Activo' : 'Pendiente'}
                </span>
                <button
                  type="button"
                  onClick={() => onRevoke(share.shr_id)}
                  className="text-xs text-bad"
                >
                  Quitar
                </button>
              </span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="self-end rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent"
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}
