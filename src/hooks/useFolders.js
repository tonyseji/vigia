import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'

/** Carpetas del usuario y las que le han compartido, con jerarquía de dos
 * niveles (fld_parent_id). Crear/renombrar/borrar sigue siendo solo del
 * dueño (RLS); compartir una carpeta de primer nivel se hace desde
 * useFolderShares. Al borrar una carpeta, los artículos quedan "Sin
 * carpeta" por el ON DELETE SET NULL de la migración 001. */
export function useFolders() {
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)

  const reload = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    setUserId(userData?.user?.id ?? null)
    const { data } = await supabase.from('folders').select('*').order('fld_order')
    setFolders(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  /** Árbol de dos niveles: carpetas de primer nivel con sus subcarpetas
   * anidadas en `children`. Con la RLS combinada, `folders` también puede
   * traer carpetas compartidas con este usuario, por eso cada carpeta lleva
   * `isOwner`. */
  const foldersTree = useMemo(() => {
    const topLevel = folders.filter((f) => f.fld_parent_id == null)
    const byParent = {}
    for (const f of folders) {
      if (f.fld_parent_id != null) {
        ;(byParent[f.fld_parent_id] = byParent[f.fld_parent_id] || []).push(f)
      }
    }
    return topLevel.map((f) => ({
      ...f,
      isOwner: f.fld_usr_id === userId,
      children: (byParent[f.fld_id] ?? []).map((c) => ({ ...c, isOwner: c.fld_usr_id === userId })),
    }))
  }, [folders, userId])

  const createFolder = useCallback(async (name, parentId = null) => {
    const trimmed = name.trim()
    if (!trimmed) return { error: 'El nombre no puede estar vacío.' }
    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) return { error: 'Sesión expirada.' }
    const { error } = await supabase.from('folders').insert({
      fld_usr_id: userData.user.id,
      fld_name: trimmed,
      fld_order: folders.length,
      fld_parent_id: parentId,
    })
    if (error) {
      return {
        error: error.message?.includes('dos niveles')
          ? 'Vigía solo admite carpetas y subcarpetas, no un tercer nivel.'
          : 'No se pudo crear la carpeta.',
      }
    }
    await reload()
    return {}
  }, [folders.length, reload])

  const renameFolder = useCallback(async (folderId, name) => {
    const trimmed = name.trim()
    if (!trimmed) return { error: 'El nombre no puede estar vacío.' }
    const { error } = await supabase.from('folders').update({ fld_name: trimmed }).eq('fld_id', folderId)
    if (error) return { error: 'No se pudo renombrar la carpeta.' }
    await reload()
    return {}
  }, [reload])

  const deleteFolder = useCallback(async (folderId) => {
    const { error } = await supabase.from('folders').delete().eq('fld_id', folderId)
    if (error) return { error: 'No se pudo borrar la carpeta.' }
    await reload()
    return {}
  }, [reload])

  return { folders, foldersTree, loading, createFolder, renameFolder, deleteFolder, reload }
}
