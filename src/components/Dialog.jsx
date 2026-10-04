import { useEffect, useId, useRef } from 'react'

// Diálogos abiertos, el de más arriba al final: Escape cierra solo ese (la
// confirmación de borrar va encima del de editar).
const openDialogs = []

/** Fondo y panel de todos los diálogos (editar, ajustes, compartir,
 * confirmar). Escape o un clic fuera lo cierran, igual que la cesta, y se
 * anuncia como diálogo modal a los lectores de pantalla. `as="form"` para
 * los que guardan con Enter. */
export default function Dialog({ title, onClose, as: Panel = 'div', className = '', children, ...panelProps }) {
  const titleId = useId()
  // onClose cambia en cada render del padre; la última siempre, sin
  // volver a suscribir el teclado.
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const self = {}
    openDialogs.push(self)
    // En captura y con preventDefault: la cesta (BasketSheet) escucha
    // Escape por su cuenta y así sabe que ya lo ha cogido un diálogo.
    const onKey = (e) => {
      if (e.key !== 'Escape' || openDialogs[openDialogs.length - 1] !== self) return
      e.preventDefault()
      closeRef.current()
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      openDialogs.splice(openDialogs.indexOf(self), 1)
    }
  }, [])

  return (
    <div
      className="dialog-backdrop fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <Panel
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className={`dialog-panel flex w-full flex-col rounded-lg border border-line bg-surface p-4 shadow-2xl shadow-black/30 ${className}`}
        {...panelProps}
      >
        <h3 id={titleId} className="font-display text-lg font-bold">
          {title}
        </h3>
        {children}
      </Panel>
    </div>
  )
}

/** «¿Seguro?» dentro de la app, en vez del confirm() del navegador (que en
 * la app instalada sale como una ventana del sistema, fuera del diseño). */
export function ConfirmDialog({ title, text, confirmLabel, onConfirm, onClose }) {
  return (
    <Dialog title={title} onClose={onClose} className="max-w-sm gap-3">
      {text && <p className="text-sm text-ink-mut">{text}</p>}
      <div className="flex justify-end gap-2">
        {/* El foco empieza en Cancelar: un Enter despistado no borra nada. */}
        <button
          type="button"
          autoFocus
          onClick={onClose}
          className="rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => {
            onClose()
            onConfirm()
          }}
          className="rounded-lg bg-bad px-3 py-1.5 text-sm font-semibold text-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bad"
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  )
}
