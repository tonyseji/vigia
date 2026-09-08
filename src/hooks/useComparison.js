import { useCallback, useState } from 'react'

/** Estado de comparación de conjuntos de artículos: puntual, solo en memoria
 * (se pierde al recargar — el usuario pidió explícitamente que no se guarde
 * en la base de datos, ver docs/DECISIONES.md). Un "conjunto" es un nombre
 * más una lista de itm_id. */
export function useComparison() {
  const [active, setActive] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [sets, setSets] = useState([])

  const toggleSelected = useCallback((itemId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(itemId) ? next.delete(itemId) : next.add(itemId)
      return next
    })
  }, [])

  const saveSet = useCallback((name) => {
    const trimmed = name.trim()
    if (!trimmed || selectedIds.size === 0) return
    setSets((prev) => [...prev, { id: crypto.randomUUID(), name: trimmed, itemIds: [...selectedIds] }])
    setSelectedIds(new Set())
  }, [selectedIds])

  const removeSet = useCallback((setId) => {
    setSets((prev) => prev.filter((s) => s.id !== setId))
  }, [])

  const stop = useCallback(() => {
    setActive(false)
    setSelectedIds(new Set())
    setSets([])
  }, [])

  return {
    active,
    start: () => setActive(true),
    stop,
    selectedIds,
    toggleSelected,
    sets,
    saveSet,
    removeSet,
  }
}
