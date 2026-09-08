/** Invitaciones que me han hecho a mí, pendientes de aceptar. Se muestra
 * como una tira encima de la lista, no como modal: no bloquea el uso de la
 * app mientras decides.
 *
 * `folder_shares` no guarda el email del dueño (solo su user_id, sin
 * significado para el invitado): `shr_fld_name` viene denormalizado desde
 * la Edge Function invite-to-folder, porque el invitado no puede leer
 * `folders` para una carpeta que todavía no ha aceptado. */
export default function PendingInvitesBanner({ invites, onAccept, onReject }) {
  if (invites.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {invites.map((invite) => (
        <div
          key={invite.shr_id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-accent bg-accent-soft px-3 py-2 text-sm"
        >
          <span>
            Te han invitado a compartir la carpeta <strong>«{invite.shr_fld_name}»</strong>.
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              onClick={() => onAccept(invite.shr_id)}
              className="rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Aceptar
            </button>
            <button
              type="button"
              onClick={() => onReject(invite.shr_id)}
              className="rounded-lg border border-line px-2.5 py-1 text-xs outline-none focus-visible:outline-2 focus-visible:outline-accent"
            >
              Rechazar
            </button>
          </span>
        </div>
      ))}
    </div>
  )
}
