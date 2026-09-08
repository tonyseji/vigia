import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import {
  subscribeToPush,
  unsubscribeFromPush,
  getPushSubscription,
  savePushSubscription,
  removePushSubscription,
} from '../lib/push.js'

/** Estado de la suscripción Web Push de este dispositivo. Portado de Bilans
 * (hooks/usePushNotifications.js), sin preferencias: esas viven en
 * user_settings y se gestionan con useSettings. */
export function usePushNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isSupported, setIsSupported] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setIsSupported(supported)
    if (!supported) {
      setIsLoading(false)
      return
    }
    if (Notification.permission === 'denied') {
      setPermissionDenied(true)
      setIsLoading(false)
      return
    }
    getPushSubscription()
      .then((sub) => {
        setIsSubscribed(!!sub)
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [])

  const enable = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const sub = await subscribeToPush()
      if (!sub) {
        setPermissionDenied(Notification.permission === 'denied')
        setError(
          Notification.permission === 'denied'
            ? 'Permiso bloqueado. Actívalo desde la configuración del navegador.'
            : 'Permiso denegado',
        )
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Sesión expirada. Vuelve a iniciar sesión.')
        return
      }
      await savePushSubscription(sub, session.access_token)
      setIsSubscribed(true)
    } catch (err) {
      setError(err?.message ?? 'Error al activar notificaciones')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const disable = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const sub = await getPushSubscription()
      if (sub) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setError('Sesión expirada. Vuelve a iniciar sesión.')
          return
        }
        await removePushSubscription(sub.endpoint, session.access_token)
        await unsubscribeFromPush()
      }
      setIsSubscribed(false)
    } catch (err) {
      setError(err?.message ?? 'Error al desactivar notificaciones')
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { isSupported, isSubscribed, permissionDenied, isLoading, error, enable, disable }
}
