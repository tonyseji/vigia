import { useEffect, useRef, useState } from 'react'
import Dialog from './Dialog.jsx'
import { usePushNotifications } from '../hooks/usePushNotifications.js'
import PasswordFields from './PasswordFields.jsx'
import IosShortcutSection from './IosShortcutSection.jsx'
import { buildBookmarklet, getOrCreateBookmarkletKey, BOOKMARK_TITLE } from '../lib/browserImport.js'
import { copyToClipboard } from '../lib/clipboard.js'

const REFRESH_LABELS = {
  off: 'Apagado',
  daily: 'Una vez al día',
  '12h': 'Cada 12 horas',
  '6h': 'Cada 6 horas',
}

/** Ajustes de refresco automático, umbral de aviso y notificaciones push,
 * más la gestión de carpetas. Mismo patrón visual que EditItemModal. */
export default function SettingsModal({ settings, onSave, onChangePassword, onClose }) {
  const [form, setForm] = useState(settings)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const push = usePushNotifications()
  const [showPassword, setShowPassword] = useState(false)

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
    <Dialog title="Ajustes" onClose={onClose} as="form" onSubmit={handleSave} className="max-h-[85vh] max-w-md gap-4 overflow-y-auto">

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

      <BookmarkletSection hasShortcutKey={settings.us_shortcut_key_hash != null} onSave={onSave} />

      <section className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-mut">Contraseña</h4>
        <p className="text-sm text-ink-mut">
          Con contraseña entras sin esperar ningún correo, también desde la app instalada en el iPhone.
        </p>
        {showPassword ? (
          <PasswordFields onSave={onChangePassword} />
        ) : (
          <button
            type="button"
            onClick={() => setShowPassword(true)}
            className="self-start rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent"
          >
            Poner o cambiar contraseña
          </button>
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
    </Dialog>
  )
}

/** Botón «Guardar en Vigía» para la barra de marcadores (src/lib/browserImport.js).
 * El href `javascript:` se pone a mano: React 18 avisa si lo recibe por
 * props. Lleva la clave de este navegador, con la que Vigía guarda sin
 * preguntar. En escritorio se arrastra; en el móvil se copia el código y se
 * pega en un favorito. La vía principal en el móvil es Compartir: Android
 * (share_target, src/lib/shareTarget.js) y el atajo de iOS
 * (IosShortcutSection). */
function BookmarkletSection({ hasShortcutKey, onSave }) {
  const linkRef = useRef(null)
  const [code, setCode] = useState('')
  const [hint, setHint] = useState(false)
  const [copied, setCopied] = useState(null) // null | 'code' | false
  // En el iPhone, la app instalada en la pantalla de inicio no comparte datos
  // con Safari: un código copiado aquí llevaría una clave que Safari no
  // conoce (el favorito funcionaría, pero pidiendo confirmar).
  // `navigator.standalone` solo existe en iOS; en Android la app instalada
  // sí comparte almacenamiento con Chrome y no hace falta avisar.
  const iosInstalledApp = window.navigator.standalone === true

  useEffect(() => {
    const link = buildBookmarklet(window.location.origin, getOrCreateBookmarkletKey())
    linkRef.current?.setAttribute('href', link)
    setCode(link)
  }, [])

  async function copyText(text, which) {
    setCopied((await copyToClipboard(text)) ? which : false)
  }

  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-mut">Guardar desde el navegador o el móvil</h4>
      <p className="text-sm text-ink-mut">
        Para guardar el producto que estás viendo sin copiar la dirección; si ya lo tenías, apunta el precio de
        hoy.
      </p>

      <div className="hidden flex-col gap-2 sm:flex">
        <p className="text-sm text-ink-mut">
          Escritorio: en Chrome, la extensión de Vigía (también actualiza sola Maisons du Monde y Kave Home). En
          otros navegadores, arrastra este botón a la barra de marcadores y púlsalo en la ficha.
        </p>
        <a
          ref={linkRef}
          onClick={(e) => {
            e.preventDefault()
            setHint(true)
          }}
          className="self-start cursor-grab rounded-lg border border-accent bg-accent-soft px-3 py-1.5 text-sm font-semibold outline-none focus-visible:outline-2 focus-visible:outline-accent"
        >
          {BOOKMARK_TITLE}
        </a>
        {hint && <p className="text-sm text-warn">Arrástralo a la barra de marcadores; aquí no hace nada.</p>}
      </div>

      <div className="flex flex-col gap-2 text-sm text-ink-mut">
        <p className="font-medium text-ink">Desde el móvil, con un toque en Compartir:</p>
        <p>
          <b>Android:</b> con Vigía instalada (Chrome → ⋮ → «Instalar aplicación»), en la ficha de un producto:
          Compartir → Vigía. Si Vigía no sale en Compartir, desinstálala y vuelve a instalarla.
        </p>
        <IosShortcutSection hasKey={hasShortcutKey} onSave={onSave} />

        <details>
          <summary className="cursor-pointer">Otra opción: favorito con código (lee el precio al momento)</summary>
          <div className="mt-2 flex flex-col gap-2">
            {iosInstalledApp && (
              <p className="text-warn">
                Estás en la app instalada: copia el código desde Vigía abierto en Safari, o el favorito te pedirá
                confirmar cada vez (la app y Safari no comparten datos).
              </p>
            )}
            <p>
              iPhone (Safari): Compartir → «Añadir a favoritos» con cualquier página, llámalo «Guardar en Vigía»;
              luego Favoritos → Editar → ese favorito: borra la dirección y pega el código. Se usa desde Favoritos.
            </p>
            <p>
              Android (Chrome): ⋮ → estrella en cualquier página → «Editar»: nombre «Guardar en Vigía» y pega el
              código como dirección. Se usa escribiendo «Guardar» en la barra de direcciones y tocando el favorito.
            </p>
            <button
              type="button"
              onClick={() => copyText(code, 'code')}
              disabled={!code}
              className="self-start rounded-lg border border-line px-3 py-1.5 text-ink outline-none focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
            >
              {copied === 'code' ? 'Copiado' : 'Copiar código'}
            </button>
          </div>
        </details>
        {copied === false && <p className="text-warn">No se pudo copiar. Inténtalo otra vez.</p>}
      </div>
    </section>
  )
}
