import { useState } from 'react'
import { passwordProblem, authErrorMessage, MIN_PASSWORD } from '../lib/authForm.js'

const TITLES = {
  password: 'Entrar',
  signup: 'Crear cuenta',
  forgot: 'Recuperar contraseña',
  magic: 'Entrar con un enlace por correo',
}

// Acceso principal con email + contraseña: se completa dentro de la app, que
// es lo único que funciona en la app instalada del iPhone (un enlace del
// correo abre Safari, con otra sesión). El enlace mágico queda como
// alternativa. Ver docs/DECISIONES.md, 2026-09-29. Solo tokens de @theme.
export default function Login({ auth, joining = false }) {
  const [mode, setMode] = useState('password') // password | signup | forgot | magic
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function switchMode(next) {
    setMode(next)
    setError('')
    setNotice('')
    setPassword('')
    setRepeat('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const cleanEmail = email.trim()
    if (!cleanEmail) return
    setError('')
    setNotice('')

    if (mode === 'signup') {
      const problem = passwordProblem(password, repeat)
      if (problem) {
        setError(problem)
        return
      }
    }

    setBusy(true)
    let result
    if (mode === 'password') result = await auth.signInWithPassword(cleanEmail, password)
    else if (mode === 'signup') result = await auth.signUpWithPassword(cleanEmail, password)
    else if (mode === 'forgot') result = await auth.sendPasswordReset(cleanEmail)
    else result = await auth.signInWithEmail(cleanEmail)
    setBusy(false)

    if (result.error) {
      setError(authErrorMessage(result.error))
      return
    }
    // En 'password' (y en 'signup' sin confirmación) la sesión llega por
    // useAuth y esta pantalla desaparece sola.
    if (mode === 'signup' && result.needsConfirmation) {
      setNotice(
        'Te hemos enviado un correo para confirmar la cuenta. Ábrelo y después entra aquí con tu contraseña. Si ya tenías cuenta en Vigía, usa «He olvidado mi contraseña» para ponerle una.',
      )
    } else if (mode === 'forgot') {
      setNotice('Te hemos enviado un correo. Ábrelo, elige tu contraseña y después entra con ella desde la app.')
    } else if (mode === 'magic') {
      setNotice('Revisa tu correo: te hemos enviado un enlace para entrar.')
    }
  }

  const inputClass =
    'rounded-lg border border-line bg-surface px-3 py-2 text-ink outline-none focus-visible:outline-2 focus-visible:outline-accent'
  const linkClass = 'self-start text-sm text-accent underline'

  const submitLabel = {
    password: busy ? 'Entrando…' : 'Entrar',
    signup: busy ? 'Creando…' : 'Crear cuenta',
    forgot: busy ? 'Enviando…' : 'Enviarme el correo',
    magic: busy ? 'Enviando…' : 'Enviarme el enlace',
  }[mode]

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Seguimiento de precios</p>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Vigía</h1>
      {joining && (
        <p className="mt-4 rounded-lg border border-accent bg-accent-soft px-4 py-3 text-sm">
          Te han invitado a una carpeta. Entra (o crea tu cuenta) y te unirás al terminar.
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink">{TITLES[mode]}</h2>
        <label className="flex flex-col gap-1 text-sm text-ink-mut">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className={inputClass}
          />
        </label>

        {(mode === 'password' || mode === 'signup') && (
          <label className="flex flex-col gap-1 text-sm text-ink-mut">
            Contraseña
            <input
              type="password"
              required
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? `Mínimo ${MIN_PASSWORD} caracteres` : ''}
              className={inputClass}
            />
          </label>
        )}
        {mode === 'signup' && (
          <label className="flex flex-col gap-1 text-sm text-ink-mut">
            Repite la contraseña
            <input
              type="password"
              required
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              className={inputClass}
            />
          </label>
        )}

        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-accent px-3 py-2 font-semibold text-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
        >
          {submitLabel}
        </button>

        {error && (
          <p className="text-sm text-bad" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-mut" role="status">
            {notice}
          </p>
        )}
      </form>

      <div className="mt-5 flex flex-col gap-2">
        {mode === 'password' ? (
          <>
            <button type="button" onClick={() => switchMode('forgot')} className={linkClass}>
              He olvidado mi contraseña (o nunca puse una)
            </button>
            <button type="button" onClick={() => switchMode('signup')} className={linkClass}>
              Crear cuenta
            </button>
            <button type="button" onClick={() => switchMode('magic')} className={linkClass}>
              Entrar con un enlace por correo
            </button>
          </>
        ) : (
          <button type="button" onClick={() => switchMode('password')} className={linkClass}>
            Volver a entrar con contraseña
          </button>
        )}
      </div>
    </main>
  )
}
