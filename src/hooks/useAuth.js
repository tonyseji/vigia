import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * Sesion de Supabase Auth (enlace magico por email). Un solo sitio que
 * conoce getSession/onAuthStateChange; el resto de la app solo lee
 * { session, loading } o llama a signIn/signOut.
 */
export function useAuth() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!active) return
      setSession(newSession)
      setLoading(false)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signInWithEmail = useCallback(async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    return { error }
  }, [])

  const signOut = useCallback(() => supabase.auth.signOut(), [])

  return { session, loading, signInWithEmail, signOut }
}
