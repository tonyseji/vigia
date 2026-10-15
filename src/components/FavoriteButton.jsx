import { IconEstrella } from './icons/index.jsx'

/** La estrella de favorito, en la esquina de la foto de la fila y de la
 * tarjeta (docs/DECISIONES.md 2026-10-16). Es de cada persona: en una
 * carpeta compartida solo marca para quien la toca. */
export default function FavoriteButton({ item, title, onToggle, className = '', iconClassName = 'h-4 w-4' }) {
  const on = Boolean(item.isFavorite)
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onToggle?.(item.itm_id, !on)}
      aria-label={on ? `Quitar ${title} de favoritos` : `Marcar ${title} como favorito`}
      title={on ? 'Quitar de favoritos' : 'Favorito'}
      className={`grid place-items-center rounded-full border bg-surface/90 outline-none focus-visible:outline-2 focus-visible:outline-accent ${on ? 'border-fav text-fav' : 'border-line text-ink-mut hover:text-fav'} ${className}`}
    >
      <IconEstrella filled={on} className={iconClassName} />
    </button>
  )
}
