/** Acceso con email + contraseña (docs/DECISIONES.md, 2026-09-29). Lógica
 * pura del formulario; las llamadas a Supabase viven en useAuth. */

export const MIN_PASSWORD = 8

/** El enlace de "recuperar contraseña" vuelve con `type=recovery` en el hash.
 * Se lee al cargar, antes de que supabase-js limpie la URL, porque el evento
 * PASSWORD_RECOVERY puede emitirse antes de que React esté escuchando. */
export function isRecoveryHash(hash) {
  return new URLSearchParams(String(hash ?? '').replace(/^#/, '')).get('type') === 'recovery'
}

export function passwordProblem(password, repeat) {
  if (password.length < MIN_PASSWORD) return `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`
  if (password !== repeat) return 'Las contraseñas no coinciden.'
  return null
}

/** Qué pasó al crear la cuenta. Si el email ya tenía cuenta confirmada,
 * Supabase no da error ni manda correo (evita enumerar cuentas): devuelve un
 * usuario con `identities` vacío. Es la señal documentada para detectarlo. */
export function signUpOutcome(data, error) {
  if (error) return 'error'
  if (data?.session) return 'session'
  if (Array.isArray(data?.user?.identities) && data.user.identities.length === 0) return 'exists'
  return 'confirm'
}

export function authErrorMessage(error) {
  const code = error?.code
  if (code === 'invalid_credentials') {
    return 'Email o contraseña incorrectos. Si nunca pusiste contraseña, usa «He olvidado mi contraseña».'
  }
  if (code === 'email_not_confirmed') {
    return 'Falta confirmar la cuenta: abre el correo que te enviamos al crearla.'
  }
  if (code === 'weak_password') return 'Esa contraseña es poco segura. Prueba con una más larga o variada.'
  if (code === 'same_password') return 'La nueva contraseña tiene que ser distinta de la anterior.'
  if (error?.status === 429 || code?.startsWith('over_')) {
    return 'Demasiados intentos seguidos. Espera un minuto e inténtalo de nuevo.'
  }
  return 'No se pudo completar. Comprueba tu conexión e inténtalo de nuevo.'
}
