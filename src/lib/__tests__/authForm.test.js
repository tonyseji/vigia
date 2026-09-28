import { describe, it, expect } from 'vitest'
import { isRecoveryHash, passwordProblem, authErrorMessage, MIN_PASSWORD } from '../authForm.js'

describe('isRecoveryHash', () => {
  it('detecta el enlace de recuperar contraseña', () => {
    expect(isRecoveryHash('#access_token=a&expires_in=3600&type=recovery')).toBe(true)
    expect(isRecoveryHash('#type=recovery&access_token=a')).toBe(true)
  })
  it('no confunde el enlace mágico ni la confirmación de cuenta', () => {
    expect(isRecoveryHash('#access_token=a&type=magiclink')).toBe(false)
    expect(isRecoveryHash('#access_token=a&type=signup')).toBe(false)
    expect(isRecoveryHash('')).toBe(false)
  })
})

describe('passwordProblem', () => {
  it('pide un mínimo de caracteres', () => {
    expect(passwordProblem('a'.repeat(MIN_PASSWORD - 1), 'a'.repeat(MIN_PASSWORD - 1))).toMatch(/al menos/)
  })
  it('avisa si la repetición no coincide', () => {
    expect(passwordProblem('contraseña1', 'contraseña2')).toMatch(/no coinciden/)
  })
  it('da por buena una contraseña larga y repetida igual', () => {
    expect(passwordProblem('contraseña1', 'contraseña1')).toBeNull()
  })
})

describe('authErrorMessage', () => {
  it('credenciales incorrectas', () => {
    expect(authErrorMessage({ code: 'invalid_credentials', status: 400 })).toMatch(/Email o contraseña incorrectos/)
  })
  it('cuenta sin confirmar', () => {
    expect(authErrorMessage({ code: 'email_not_confirmed', status: 400 })).toMatch(/confirmar/)
  })
  it('contraseña débil según Supabase', () => {
    expect(authErrorMessage({ code: 'weak_password', status: 422 })).toMatch(/segura/)
  })
  it('misma contraseña que la anterior', () => {
    expect(authErrorMessage({ code: 'same_password', status: 422 })).toMatch(/distinta/)
  })
  it('límite de correos o de intentos', () => {
    expect(authErrorMessage({ code: 'over_email_send_rate_limit', status: 429 })).toMatch(/Espera/)
    expect(authErrorMessage({ status: 429 })).toMatch(/Espera/)
  })
  it('cualquier otro error, en palabras llanas', () => {
    expect(authErrorMessage({ message: 'Failed to fetch' })).toMatch(/No se pudo/)
    expect(authErrorMessage(null)).toMatch(/No se pudo/)
  })
})
