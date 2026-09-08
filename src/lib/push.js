// Web Push del lado del navegador: registrar el Service Worker, suscribir y
// persistir en la Edge Function push-subscribe. Portado de Bilans
// (src/services/pushNotifications.js). Las preferencias de aviso viven en
// user_settings (useSettings.js), no aquí.

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker no soportado en este navegador')
  }
  return await navigator.serviceWorker.register('/sw.js')
}

export async function subscribeToPush() {
  const reg = await registerServiceWorker()
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null
  return await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })
}

export async function unsubscribeFromPush() {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  if (!reg) return
  const sub = await reg.pushManager.getSubscription()
  if (sub) await sub.unsubscribe()
}

export async function getPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  if (!reg) return null
  return await reg.pushManager.getSubscription()
}

async function callPushSubscribe(body, accessToken) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    throw new Error(msg || 'Error al comunicarse con push-subscribe')
  }
}

export async function savePushSubscription(subscription, accessToken) {
  const { endpoint, keys } = subscription.toJSON()
  await callPushSubscribe({ action: 'subscribe', endpoint, p256dh: keys.p256dh, auth: keys.auth }, accessToken)
}

export async function removePushSubscription(endpoint, accessToken) {
  await callPushSubscribe({ action: 'unsubscribe', endpoint }, accessToken)
}
