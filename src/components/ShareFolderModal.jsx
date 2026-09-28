import { useState } from 'react'
import { copyToClipboard } from '../lib/clipboard.js'
import { buildShareUrl, shareLabel } from '../lib/shareLink.js'

/** Compartir una carpeta de primer nivel con un enlace de invitación
 * (docs/DECISIONES.md, 2026-09-29) y ver/revocar quién tiene acceso.
 * Mismo patrón visual que EditItemModal. */
export default function ShareFolderModal({ folder, shares, onCreateLink, onRevoke, onClose }) {
  const [link, setLink] = useState(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [copiedUrl, setCopiedUrl] = useState(null)
  const [copyFailed, setCopyFailed] = useState(false)

  // El menú de compartir del sistema solo existe en móvil y en algunos
  // navegadores de escritorio; donde no, se copia.
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  async function handleCreate() {
    setCreating(true)
    setError('')
    const result = await onCreateLink(folder.fld_id)
    setCreating(false)
    if (result?.error) {
      setError(result.error)
      return
    }
    setLink(result.url)
  }

  async function handleSend(url) {
    // Se llama directamente desde el toque, sin esperas antes: Safari exige
    // que navigator.share salga de un gesto del usuario.
    try {
      await navigator.share({
        title: 'Vigía',
        text: `Te invito a mi carpeta «${folder.fld_name}» en Vigía:`,
        url,
      })
    } catch {
      // Cancelado por el usuario: no es un error.
    }
  }

  async function handleCopy(url) {
    if (await copyToClipboard(url)) {
      setCopiedUrl(url)
      setCopyFailed(false)
      return
    }
    // Algunos navegadores (los internos de otras apps, p. ej.) no dejan
    // escribir en el portapapeles: se muestra el enlace para copiarlo a mano.
    setLink(url)
    setCopyFailed(true)
  }

  const now = new Date()

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-sm flex-col gap-3 rounded-lg border border-line bg-surface p-4"
      >
        <h3 className="font-display text-lg font-bold">Compartir «{folder.fld_name}»</h3>
        <p className="text-sm text-ink-mut">
          Quien abra el enlace verá y podrá editar esta carpeta, sus subcarpetas y los artículos dentro, igual que tú.
          Cada enlace sirve para una persona y caduca en 7 días.
        </p>

        {link ? (
          <div className="flex flex-col gap-2 rounded-lg border border-accent bg-accent-soft p-2.5">
            <input
              readOnly
              value={link}
              aria-label="Enlace de invitación"
              onFocus={(e) => e.target.select()}
              className="w-full rounded border border-line bg-surface px-2 py-1 font-mono text-xs text-ink-mut outline-none focus-visible:outline-2 focus-visible:outline-accent"
            />
            {copyFailed && (
              <p className="text-xs text-ink-mut" role="status">
                No se pudo copiar solo. Mantén pulsado el enlace (o selecciónalo) para copiarlo.
              </p>
            )}
            <div className="flex gap-2">
              {canShare && (
                <button
                  type="button"
                  onClick={() => handleSend(link)}
                  className="flex-1 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Enviar…
                </button>
              )}
              <button
                type="button"
                onClick={() => handleCopy(link)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent ${
                  canShare ? 'border border-line bg-surface' : 'bg-accent font-semibold text-surface'
                }`}
              >
                {copiedUrl === link ? 'Copiado' : 'Copiar enlace'}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
          >
            {creating ? 'Creando…' : 'Crear enlace de invitación'}
          </button>
        )}

        {error && (
          <p className="text-sm text-bad" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          {shares.length === 0 && <p className="text-sm text-ink-mut">Nadie tiene acceso todavía.</p>}
          {shares.map((share) => {
            const label = shareLabel(share, now)
            const shareUrl = label.usableLink ? buildShareUrl(window.location.origin, share.shr_token) : null
            return (
              <div
                key={share.shr_id}
                className="flex items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm"
              >
                <span className="min-w-0 truncate">{label.who}</span>
                <span className="flex flex-none items-center gap-2">
                  <span className="text-xs text-ink-mut">{label.status}</span>
                  {shareUrl && (
                    <button
                      type="button"
                      onClick={() => (canShare ? handleSend(shareUrl) : handleCopy(shareUrl))}
                      className="text-xs text-accent"
                    >
                      {canShare ? 'Enviar' : copiedUrl === shareUrl ? 'Copiado' : 'Copiar'}
                    </button>
                  )}
                  <button type="button" onClick={() => onRevoke(share.shr_id)} className="text-xs text-bad">
                    Quitar
                  </button>
                </span>
              </div>
            )
          })}
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
