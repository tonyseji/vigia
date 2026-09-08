import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

/** Invitaciones a compartir carpetas: las que yo he emitido como dueño, y
 * las que me han hecho a mí como invitado. Ver docs/superpowers/specs/
 * 2026-09-06-carpetas-compartidas-design.md. */
export function useFolderShares() {
  const [shares, setShares] = useState([])
  const [userId, setUserId] = useState(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    setUserId(userData?.user?.id ?? null)
    const { data } = await supabase.from('folder_shares').select('*').order('shr_created_at', { ascending: false })
    setShares(data ?? [])
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

  const invite = useCallback(async (folderId, email) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { error: 'Sesión expirada.' }
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-to-folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ fld_id: folderId, email }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { error: data.error || 'No se pudo enviar la invitación.' }
    await reload()
    return {}
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

  return { shares, sharesByFolder, pendingForMe, loading, invite, acceptShare, rejectShare, revokeShare }
}
