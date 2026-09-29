import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const DEFAULTS = {
  us_refresh_mode: 'daily',
  us_refresh_hour: 4,
  us_last_refresh_at: null,
  us_notify_enabled: true,
  us_notify_kind: 'any',
  us_notify_pct: 5,
  us_notify_eur: 10,
  us_notify_min_hist: true,
  us_notify_back_in_stock: true,
}

/** Ajustes del usuario: refresco automático y umbral de aviso. Crea la fila
 * si todavía no existe (usuarios registrados antes de esta migración). */
export function useSettings() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  // Los valores por defecto son solo para quien aún no tiene fila, nunca
  // para un fallo de lectura: si no, guardar Ajustes pisaría los reales (B16).
  const reload = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) {
      setLoading(false)
      return
    }
    const { data, error } = await supabase.from('user_settings').select('*').eq('us_usr_id', userData.user.id).maybeSingle()
    if (!error) setSettings(data ?? { ...DEFAULTS, us_usr_id: userData.user.id })
    setLoadError(Boolean(error))
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const save = useCallback(async (changes) => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) return { error: 'Sesión expirada.' }
    const { data, error } = await supabase
      .from('user_settings')
      .upsert({ us_usr_id: userData.user.id, ...changes }, { onConflict: 'us_usr_id' })
      .select()
      .single()
    if (error) return { error: 'No se pudo guardar el ajuste.' }
    setSettings(data)
    return {}
  }, [])

  return { settings, loading, loadError, reload, save }
}
