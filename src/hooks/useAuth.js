import { useEffect, useState, useCallback } from 'react'
import { supabase, openedFromPasswordRecovery } from '../lib/supabase.js'
import { buildShareUrl, loadPendingJoin } from '../lib/shareLink.js'

/**
 * Sesion de Supabase Auth: email + contraseña (principal, funciona en la app
 * instalada del iPhone) y enlace magico por email como alternativa. Ver
 * docs/DECISIONES.md, 2026-09-29. Un solo sitio que conoce
 * getSession/onAuthStateChange; el resto de la app solo lee el estado o
 * llama a estas funciones.
 */
/** A dónde vuelve el enlace de cualquier correo de acceso. Con una
 * invitación pendiente lleva el token: el correo puede abrirse en otro
 * navegador (el interno de Gmail, p. ej.) que no lo tiene guardado. Si
 * Supabase no admite esa URL de vuelta, usa la Site URL y el token sigue
 * guardado en este navegador. */
function returnUrl() {
  const joinToken = loadPendingJoin()
  return joinToken ? buildShareUrl(window.location.origin, joinToken) : window.location.origin
}

export function useAuth() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  // Entró con el enlace de "recuperar contraseña": hay sesión, pero antes de
  // la app toca elegir contraseña nueva.
  const [recovering, setRecovering] = useState(openedFromPasswordRecovery)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(newSession)
      setLoading(false)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signInWithEmail = useCallback(async (email) => {
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: returnUrl() } })
    return { error }
  }, [])

  const signInWithPassword = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }, [])

  /** Crea la cuenta. Si Supabase exige confirmar el email, no hay sesión
   * hasta abrir el correo; si ya existía la cuenta, Supabase no lo dice
   * (evita enumerar cuentas) y tampoco hay sesión. */
  const signUpWithPassword = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: returnUrl() },
    })
    return { error, needsConfirmation: !error && !data.session }
  }, [])

  const sendPasswordReset = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: returnUrl() })
    return { error }
  }, [])

  const updatePassword = useCallback(async (password) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (!error) setRecovering(false)
    return { error }
  }, [])

  const finishRecovery = useCallback(() => setRecovering(false), [])

  const signOut = useCallback(() => supabase.auth.signOut(), [])

  return {
    session,
    loading,
    recovering,
    signInWithEmail,
    signInWithPassword,
    signUpWithPassword,
    sendPasswordReset,
    updatePassword,
    finishRecovery,
    signOut,
  }
}
