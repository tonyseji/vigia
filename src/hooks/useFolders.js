import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import { useReloadOnReturn } from './useReloadOnReturn.js'
import { foldersInTreeOrder } from '../lib/itemGroups.js'

/** Carpetas del usuario y las que le han compartido, con jerarquía de hasta
 * tres niveles (fld_parent_id, migración 025). En una compartida, quien tiene acceso renombra y
 * crea o borra subcarpetas igual que el dueño; borrar la de primer nivel y
 * compartirla (useFolderShares) son solo del dueño (RLS, migración 023). Una
 * subcarpeta nueva queda a nombre del dueño del padre (trigger). Al borrar
 * una carpeta, los artículos quedan "Sin carpeta" por el ON DELETE SET NULL
 * de la migración 001. */
export function useFolders() {
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)
  const [loadError, setLoadError] = useState(false)

  // Si la lectura falla se conservan las carpetas que ya había y se avisa:
  // vaciar la lista escondió la recursión RLS de B14 durante días (B16).
  const reload = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    setUserId(userData?.user?.id ?? null)
    const { data, error } = await supabase.from('folders').select('*').order('fld_order')
    if (!error) setFolders(data ?? [])
    setLoadError(Boolean(error))
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])
  useReloadOnReturn(reload)

  /** Árbol: carpetas de primer nivel con sus subcarpetas anidadas en
   * `children`, a cualquier profundidad, y su `depth` (0 = primer nivel).
   * Con la RLS combinada, `folders` también puede traer carpetas compartidas
   * con este usuario, por eso cada carpeta lleva `isOwner`. */
  const foldersTree = useMemo(() => {
    const byParent = {}
    for (const f of folders) {
      if (f.fld_parent_id != null) {
        ;(byParent[f.fld_parent_id] = byParent[f.fld_parent_id] || []).push(f)
      }
    }
    const build = (f, depth) => ({
      ...f,
      depth,
      isOwner: f.fld_usr_id === userId,
      children: (byParent[f.fld_id] ?? []).map((c) => build(c, depth + 1)),
    })
    return folders.filter((f) => f.fld_parent_id == null).map((f) => build(f, 0))
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
        error: error.message?.includes('tres niveles')
          ? 'Vigía admite como mucho tres niveles de carpetas.'
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

  // Los selectores de carpeta (tarjeta, fila, editar) las pintan en este
  // orden, el mismo del sidebar.
  const orderedFolders = useMemo(() => foldersInTreeOrder(folders), [folders])

  return { folders: orderedFolders, foldersTree, loading, loadError, createFolder, renameFolder, deleteFolder, reload }
}
