import { useState } from 'react'
import { copyToClipboard } from '../lib/clipboard.js'
import { SAVE_LINK_URL, SHORTCUT_ICLOUD_URL, hashShortcutKey, newShortcutKey } from '../lib/shortcutKey.js'

const btn =
  'self-start rounded-lg border border-line px-3 py-1.5 text-ink outline-none focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60'

/** Atajo de iOS «Guardar en Vigía» (src/lib/shortcutKey.js). Un botón: crea
 * la clave, la copia y abre el atajo de iCloud; Atajos pide la clave al
 * añadirlo y se pega. Los pasos para montarlo a mano quedan plegados. */
export default function IosShortcutSection({ hasKey, onSave }) {
  const [status, setStatus] = useState(null) // null | 'saving' | 'ready' | 'off' | 'error'
  const [key, setKey] = useState('')
  const [copied, setCopied] = useState(null) // null | true | false
  const [copiedUrl, setCopiedUrl] = useState(false)

  /** La clave se copia antes de cualquier espera: Safari solo deja escribir
   * en el portapapeles dentro del toque. Crear otra anula la anterior. */
  function createKey() {
    const fresh = newShortcutKey()
    const copying = copyToClipboard(fresh)
    setKey(fresh)
    setStatus('saving')
    hashShortcutKey(fresh)
      .then((hash) => onSave({ us_shortcut_key_hash: hash }))
      .then((result) => setStatus(result?.error ? 'error' : 'ready'))
      .catch(() => setStatus('error'))
    copying.then(setCopied)
  }

  async function disable() {
    const result = await onSave({ us_shortcut_key_hash: null })
    setKey('')
    setStatus(result?.error ? 'error' : 'off')
  }

  async function copyUrl() {
    setCopiedUrl(await copyToClipboard(SAVE_LINK_URL))
  }

  return (
    <div className="flex flex-col gap-2">
      <p>
        <b>iPhone:</b> Compartir → «Guardar en Vigía», desde Safari o cualquier app. Se añade una vez y guarda sin
        abrir nada; te avisa con el título y el precio.
      </p>

      {SHORTCUT_ICLOUD_URL && (
        <a
          href={SHORTCUT_ICLOUD_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={createKey}
          className="self-start rounded-lg bg-accent px-3 py-1.5 font-semibold text-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Añadir atajo
        </a>
      )}

      {status === 'error' && <p className="text-bad">No se pudo guardar la clave. Vuelve a intentarlo.</p>}
      {status === 'off' && <p>Atajo desactivado: ya no guarda nada hasta que lo vuelvas a añadir.</p>}
      {key && status !== 'error' && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-accent bg-accent-soft p-2.5 text-ink">
          <p>
            {copied === false
              ? 'Copia esta clave y pégala cuando Atajos te la pida:'
              : 'Clave copiada. Cuando Atajos te la pida, pégala y toca «Añadir atajo».'}
          </p>
          <input
            readOnly
            value={key}
            onFocus={(e) => e.target.select()}
            aria-label="Clave del atajo"
            className="w-full rounded border border-line bg-surface px-2 py-1 font-mono text-xs"
          />
        </div>
      )}
      {hasKey && !key && status !== 'off' && (
        <p className="flex flex-wrap items-center gap-2">
          <span>Atajo activo.</span>
          <button type="button" onClick={disable} className={btn}>
            Desactivar
          </button>
        </p>
      )}

      <details open={!SHORTCUT_ICLOUD_URL}>
        <summary className="cursor-pointer">
          {SHORTCUT_ICLOUD_URL ? '¿No se abre? Móntalo a mano' : 'Cómo añadirlo (2 minutos, una vez)'}
        </summary>
        <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5">
          <li>
            En la app <b>Atajos</b>: «+» y ponle de nombre «Guardar en Vigía». En la ⓘ, activa «Mostrar en hoja de
            compartir».
          </li>
          <li>
            Añade la acción <b>«Obtener contenido de URL»</b> y pega en ella la dirección:{' '}
            <button type="button" onClick={copyUrl} className={btn}>
              {copiedUrl ? 'Copiada' : 'Copiar dirección'}
            </button>
          </li>
          <li>
            En esa acción, «Mostrar más»: Método <b>POST</b>, Cuerpo de solicitud <b>JSON</b>, y dos campos de texto:{' '}
            <code>url</code> con la variable «Entrada del atajo», y <code>key</code> con tu clave:{' '}
            <button type="button" onClick={createKey} className={btn}>
              {hasKey ? 'Copiar clave nueva' : 'Copiar clave'}
            </button>
          </li>
          <li>
            Añade <b>«Mostrar notificación»</b> con «Contenido de URL». Listo: en una tienda, Compartir → «Guardar en
            Vigía» (está en la lista de abajo de la hoja de compartir).
          </li>
        </ol>
        {hasKey && <p className="mt-2">Una clave nueva deja sin valor la anterior: el atajo viejo dejará de guardar.</p>}
      </details>
    </div>
  )
}
