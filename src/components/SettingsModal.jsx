import { useState } from 'react'
import { usePushNotifications } from '../hooks/usePushNotifications.js'

const REFRESH_LABELS = {
  off: 'Apagado',
  daily: 'Una vez al día',
  '12h': 'Cada 12 horas',
  '6h': 'Cada 6 horas',
}

/** Ajustes de refresco automático, umbral de aviso y notificaciones push,
 * más la gestión de carpetas. Mismo patrón visual que EditItemModal. */
export default function SettingsModal({ settings, onSave, onClose }) {
  const [form, setForm] = useState(settings)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const push = usePushNotifications()

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const result = await onSave({
      us_refresh_mode: form.us_refresh_mode,
      us_refresh_hour: Number(form.us_refresh_hour),
      us_notify_enabled: form.us_notify_enabled,
      us_notify_kind: form.us_notify_kind,
      us_notify_pct: Number(form.us_notify_pct),
      us_notify_eur: Number(form.us_notify_eur),
      us_notify_min_hist: form.us_notify_min_hist,
      us_notify_back_in_stock: form.us_notify_back_in_stock,
    })
    setSaving(false)
    if (result?.error) {
      setError(result.error)
      return
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <form
        onSubmit={handleSave}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-lg border border-line bg-surface p-4"
      >
        <h3 className="font-display text-lg font-bold">Ajustes</h3>

        <section className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-mut">Refresco automático</h4>
          <label className="flex flex-col gap-1 text-sm text-ink-mut">
            Frecuencia
            <select
              value={form.us_refresh_mode}
              onChange={(e) => set('us_refresh_mode', e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-ink outline-none focus-visible:outline-2 focus-visible:outline-accent"
            >
              {Object.entries(REFRESH_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {form.us_refresh_mode === 'daily' && (
            <label className="flex flex-col gap-1 text-sm text-ink-mut">
              Hora del pase (0-23)
              <input
                type="number"
                min={0}
                max={23}
                value={form.us_refresh_hour}
                onChange={(e) => set('us_refresh_hour', e.target.value)}
                className="rounded-lg border border-line bg-surface px-3 py-1.5 text-ink outline-none focus-visible:outline-2 focus-visible:outline-accent"
              />
            </label>
          )}
          {settings.us_last_refresh_at && (
            <p className="text-xs text-ink-mut">
              Último pase automático: {new Date(settings.us_last_refresh_at).toLocaleString('es-ES')}
            </p>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-mut">Avisos de precio</h4>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.us_notify_enabled}
              onChange={(e) => set('us_notify_enabled', e.target.checked)}
            />
            Avisar cuando baje un precio
          </label>

          {form.us_notify_enabled && (
            <>
              <div className="flex flex-col gap-1.5 pl-1 text-sm text-ink-mut">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="notify_kind"
                    checked={form.us_notify_kind === 'any'}
                    onChange={() => set('us_notify_kind', 'any')}
                  />
                  Cualquier bajada
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="notify_kind"
                    checked={form.us_notify_kind === 'pct'}
                    onChange={() => set('us_notify_kind', 'pct')}
                  />
                  Bajadas de al menos
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={form.us_notify_pct}
                    onChange={(e) => set('us_notify_pct', e.target.value)}
                    disabled={form.us_notify_kind !== 'pct'}
                    className="w-16 rounded-lg border border-line bg-surface px-2 py-1 text-ink outline-none disabled:opacity-50"
                  />
                  %
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="notify_kind"
                    checked={form.us_notify_kind === 'eur'}
                    onChange={() => set('us_notify_kind', 'eur')}
                  />
                  Bajadas de al menos
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={form.us_notify_eur}
                    onChange={(e) => set('us_notify_eur', e.target.value)}
                    disabled={form.us_notify_kind !== 'eur'}
                    className="w-16 rounded-lg border border-line bg-surface px-2 py-1 text-ink outline-none disabled:opacity-50"
                  />
                  €
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={form.us_notify_min_hist}
                  onChange={(e) => set('us_notify_min_hist', e.target.checked)}
                />
                Avisar siempre al tocar el mínimo histórico
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={form.us_notify_back_in_stock}
                  onChange={(e) => set('us_notify_back_in_stock', e.target.checked)}
                />
                Avisar cuando vuelva a haber stock
              </label>
            </>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-mut">Notificaciones en este dispositivo</h4>
          {!push.isSupported ? (
            <p className="text-sm text-ink-mut">Este navegador no admite notificaciones push.</p>
          ) : push.permissionDenied ? (
            <p className="text-sm text-warn">Bloqueadas por el navegador. Actívalas desde su configuración.</p>
          ) : (
            <button
              type="button"
              onClick={push.isSubscribed ? push.disable : push.enable}
              disabled={push.isLoading}
              className="self-start rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
            >
              {push.isLoading ? 'Un momento…' : push.isSubscribed ? 'Desactivar en este dispositivo' : 'Activar en este dispositivo'}
            </button>
          )}
          {push.error && (
            <p className="text-sm text-bad" role="alert">
              {push.error}
            </p>
          )}
        </section>

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
            Cerrar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  )
}
