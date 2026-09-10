import { useState, useEffect } from 'react'

// Portado de Bilans (components/InstallBanner.jsx), con los tokens de Vigía.

const ua = navigator.userAgent
const isIos = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
const isAndroid = /android/i.test(ua)
const isIosSafari = isIos && !/(CriOS|FxiOS|EdgiOS|OPiOS|OPT|mercury)/i.test(ua)
const isStandalone =
  window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches

const DISMISSED_IOS = 'vigia_ios_install_dismissed'
const DISMISSED_ANDROID = 'vigia_android_install_dismissed'
const SESSION_KEY = 'vigia_install_dismissed_session'

function isDismissedForever() {
  if (isIos) return localStorage.getItem(DISMISSED_IOS) === '1'
  if (isAndroid) return localStorage.getItem(DISMISSED_ANDROID) === '1'
  return true
}

function saveForever() {
  if (isIos) localStorage.setItem(DISMISSED_IOS, '1')
  if (isAndroid) localStorage.setItem(DISMISSED_ANDROID, '1')
}

function isDismissedThisSession() {
  return sessionStorage.getItem(SESSION_KEY) === '1'
}

function saveSession() {
  sessionStorage.setItem(SESSION_KEY, '1')
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [androidReady, setAndroidReady] = useState(false)
  const [visible, setVisible] = useState(
    !isStandalone && !isDismissedForever() && !isDismissedThisSession() && (isIos || isAndroid),
  )

  useEffect(() => {
    if (!isAndroid || !visible) return
    function onBIP(e) {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', onBIP)
    const timer = setTimeout(() => setAndroidReady(true), 1500)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP)
      clearTimeout(timer)
    }
  }, [visible])

  useEffect(() => {
    if (deferredPrompt) setAndroidReady(true)
  }, [deferredPrompt])

  if (!visible) return null
  if (isAndroid && !androidReady) return null

  let mode
  if (isIos) mode = isIosSafari ? 'ios-safari' : 'ios-other'
  else if (isAndroid) mode = deferredPrompt ? 'android-native' : 'android-manual'
  else return null

  function dismissForever() {
    saveForever()
    setVisible(false)
  }

  function dismissThisSession() {
    saveSession()
    setVisible(false)
  }

  async function installNative() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    setDeferredPrompt(null)
    dismissForever()
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/60 px-5 py-8">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-lg border border-line bg-surface px-6 py-7 text-center">
        {mode === 'ios-safari' && <IosSafariContent onDone={dismissForever} onSnooze={dismissThisSession} />}
        {mode === 'ios-other' && <IosOtherContent onDone={dismissForever} onSnooze={dismissThisSession} />}
        {mode === 'android-native' && (
          <AndroidNativeContent onInstall={installNative} onSnooze={dismissThisSession} />
        )}
        {mode === 'android-manual' && <AndroidManualContent onDone={dismissForever} onSnooze={dismissThisSession} />}
      </div>
    </div>
  )
}

function PrimaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {children}
    </button>
  )
}

function SnoozeButton({ onClick }) {
  return (
    <button onClick={onClick} className="bg-transparent text-xs text-ink-mut underline">
      Ahora no
    </button>
  )
}

function IosSafariContent({ onDone, onSnooze }) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-bold">Instala Vigía en tu iPhone</h2>
        <p className="text-sm leading-relaxed text-ink-mut">
          Añádela a tu pantalla de inicio para recibir avisos de precio. Solo tarda 10 segundos.
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        <Step number="1">
          Pulsa el botón <strong className="text-ink">Compartir</strong> en la barra de Safari
        </Step>
        <Step number="2">
          Busca <strong className="text-ink">«Añadir a pantalla de inicio»</strong> y pulsa{' '}
          <strong className="text-ink">Añadir</strong>
        </Step>
        <Step number="3">¡Listo! Vigía aparecerá en tu pantalla como una app</Step>
      </div>
      <PrimaryButton onClick={onDone}>Ya lo hice ✓</PrimaryButton>
      <SnoozeButton onClick={onSnooze} />
    </>
  )
}

function IosOtherContent({ onDone, onSnooze }) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-bold">Instala Vigía en tu iPhone</h2>
        <p className="text-sm leading-relaxed text-ink-mut">
          Para instalar Vigía como app necesitas abrirla en <strong className="text-ink">Safari</strong>. Apple
          solo permite instalar apps web desde Safari.
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        <Step number="1">Abre esta misma dirección en Safari</Step>
        <Step number="2">Sigue las instrucciones de instalación que aparecerán ahí</Step>
      </div>
      <PrimaryButton onClick={onDone}>Entendido</PrimaryButton>
      <SnoozeButton onClick={onSnooze} />
    </>
  )
}

function AndroidNativeContent({ onInstall, onSnooze }) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-bold">Instala Vigía en tu Android</h2>
        <p className="text-sm leading-relaxed text-ink-mut">
          Añade Vigía a tu pantalla de inicio para recibir avisos de precio.
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        <Step number="1">Pulsa «Instalar app» aquí abajo</Step>
        <Step number="2">Confirma en el diálogo que aparecerá en pantalla</Step>
      </div>
      <PrimaryButton onClick={onInstall}>Instalar app</PrimaryButton>
      <SnoozeButton onClick={onSnooze} />
    </>
  )
}

function AndroidManualContent({ onDone, onSnooze }) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-bold">Instala Vigía en tu Android</h2>
        <p className="text-sm leading-relaxed text-ink-mut">
          Añade Vigía a tu pantalla de inicio. Solo tarda 10 segundos.
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        <Step number="1">Pulsa el menú de tres puntos en la esquina superior del navegador</Step>
        <Step number="2">
          Busca <strong className="text-ink">«Instalar app»</strong> o{' '}
          <strong className="text-ink">«Añadir a pantalla de inicio»</strong>
        </Step>
      </div>
      <PrimaryButton onClick={onDone}>Ya lo hice ✓</PrimaryButton>
      <SnoozeButton onClick={onSnooze} />
    </>
  )
}

function Step({ number, children }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-surface-2 px-3.5 py-3 text-left">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[0.65rem] font-bold text-surface">
        {number}
      </span>
      <p className="text-sm leading-snug text-ink-mut">{children}</p>
    </div>
  )
}
