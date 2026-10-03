import { useEffect } from 'react'

/** Vuelve a leer al volver a la app (pestaña o PWA otra vez visible). Lo
 * guardado desde fuera — botón «+ Vigía», extensión, pase diario — no
 * aparecía hasta recargar la página. */
export function useReloadOnReturn(reload) {
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload])
}
