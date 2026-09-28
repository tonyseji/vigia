import { useState } from 'react'
import { passwordProblem, authErrorMessage, MIN_PASSWORD } from '../lib/authForm.js'

/** Elegir contraseña (nueva o cambiada). Sin <form> propio porque también
 * vive dentro del formulario de Ajustes: Enter guarda la contraseña en vez
 * de enviar los ajustes. */
export default function PasswordFields({ submitLabel = 'Guardar contraseña', onSave, onDone }) {
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    const problem = passwordProblem(password, repeat)
    if (problem) {
      setError(problem)
      return
    }
    setSaving(true)
    setError('')
    const { error: saveError } = await onSave(password)
    setSaving(false)
    if (saveError) {
      setError(authErrorMessage(saveError))
      return
    }
    setSaved(true)
    setPassword('')
    setRepeat('')
    onDone?.()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    }
  }

  const inputClass =
    'rounded-lg border border-line bg-surface px-3 py-2 text-ink outline-none focus-visible:outline-2 focus-visible:outline-accent'

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm text-ink-mut">
        Contraseña nueva
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setSaved(false)
          }}
          onKeyDown={handleKeyDown}
          placeholder={`Mínimo ${MIN_PASSWORD} caracteres`}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-mut">
        Repítela
        <input
          type="password"
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          onKeyDown={handleKeyDown}
          className={inputClass}
        />
      </label>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="self-start rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
      >
        {saving ? 'Guardando…' : submitLabel}
      </button>
      {error && (
        <p className="text-sm text-bad" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="text-sm text-ink-mut" role="status">
          Contraseña guardada. Ya puedes entrar con ella desde cualquier dispositivo.
        </p>
      )}
    </div>
  )
}
