import { useState } from 'react'

// Enlace magico por email: sin contrasena. Tres estados segun docs/DISENO.md
// (enviando, "mira tu correo", error en palabras llanas). Solo tokens de
// @theme, ningun hex suelto.
export default function Login({ onSignIn }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('sending')
    setErrorMsg('')
    const { error } = await onSignIn(email.trim())
    if (error) {
      setStatus('error')
      setErrorMsg('No se pudo enviar el enlace. Comprueba el email e inténtalo de nuevo.')
      return
    }
    setStatus('sent')
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
        Seguimiento de precios
      </p>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Vigía</h1>

      {status === 'sent' ? (
        <p className="mt-6 rounded-lg border border-line bg-surface px-4 py-3 text-ink-mut">
          Revisa tu correo: te hemos enviado un enlace para entrar.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          <label htmlFor="email" className="text-sm text-ink-mut">
            Tu email para recibir el enlace de acceso
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="rounded-lg border border-line bg-surface px-3 py-2 text-ink outline-none focus-visible:outline-2 focus-visible:outline-accent"
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            className="rounded-lg bg-accent px-3 py-2 font-semibold text-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
          >
            {status === 'sending' ? 'Enviando…' : 'Enviarme el enlace'}
          </button>
          {status === 'error' && (
            <p className="text-sm text-bad" role="alert">
              {errorMsg}
            </p>
          )}
        </form>
      )}
    </main>
  )
}
