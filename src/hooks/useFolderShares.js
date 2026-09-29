import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { buildShareUrl, joinErrorMessage } from '../lib/shareLink.js'

/** Invitaciones a compartir carpetas: las que yo he emitido como dueño, y
 * las que me han hecho a mí como invitado. Ver docs/superpowers/specs/
 * 2026-09-06-carpetas-compartidas-design.md. */
export function useFolderShares() {
  const [shares, setShares] = useState([])
  const [userId, setUserId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  // Mismo criterio que useFolders: un fallo de lectura avisa, no vacía (B16).
  const reload = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    setUserId(userData?.user?.id ?? null)
    const { data, error } = await supabase.from('folder_shares').select('*').order('shr_created_at', { ascending: false })
    if (!error) setShares(data ?? [])
    setLoadError(Boolean(error))
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const sharesByFolder = useCallback(
    (folderId) => shares.filter((s) => s.shr_fld_id === folderId && s.shr_status !== 'revoked'),
    [shares],
  )

  const pendingForMe = shares.filter((s) => s.shr_invited_usr_id === userId && s.shr_status === 'pending')

  /** Crea un enlace de invitación de un solo uso (7 días) para una carpeta
   * de primer nivel. Devuelve la URL lista para mandar. */
  const createShareLink = useCallback(async (folderId) => {
    const { data, error } = await supabase.rpc('create_folder_share_link', { p_fld_id: folderId })
    if (error || !data) return { error: 'No se pudo crear el enlace. Inténtalo de nuevo.' }
    await reload()
    return { url: buildShareUrl(window.location.origin, data) }
  }, [reload])

  /** Unirse a una carpeta con el token de un enlace de invitación. */
  const acceptShareLink = useCallback(async (token) => {
    const { data, error } = await supabase.rpc('accept_folder_share_link', { p_token: token })
    if (error) return { error: joinErrorMessage(error.message) }
    await reload()
    return { folderId: data.fld_id, folderName: data.fld_name }
  }, [reload])

  const acceptShare = useCallback(async (shareId) => {
    const { error } = await supabase.rpc('accept_folder_share', { p_shr_id: shareId })
    if (error) return { error: 'No se pudo aceptar la invitación.' }
    await reload()
    return {}
  }, [reload])

  const rejectShare = useCallback(async (shareId) => {
    const { error } = await supabase.rpc('reject_folder_share', { p_shr_id: shareId })
    if (error) return { error: 'No se pudo rechazar la invitación.' }
    await reload()
    return {}
  }, [reload])

  const revokeShare = useCallback(async (shareId) => {
    const { error } = await supabase.rpc('revoke_folder_share', { p_shr_id: shareId })
    if (error) return { error: 'No se pudo revocar el acceso.' }
    await reload()
    return {}
  }, [reload])

  return { shares, sharesByFolder, pendingForMe, loading, loadError, reload, createShareLink, acceptShareLink, acceptShare, rejectShare, revokeShare }
}
