import { useCallback, useEffect, useState } from 'react'
import { addToBasket, loadBasket, pruneBasket, saveBasket, setQuantity } from '../lib/basket.js'

/** Estado de la cesta (src/lib/basket.js): qué artículos lleva y cuántos,
 * guardado en este navegador, y si se está eligiendo (casillas visibles).
 *
 * `itemsById` + `itemsReady` sirven para sacar los artículos borrados; solo
 * con la lista cargada sin errores, o un fallo de lectura vaciaría la cesta. */
export function useBasket(itemsById, itemsReady) {
  const [basket, setBasket] = useState(loadBasket)
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    saveBasket(basket)
  }, [basket])

  useEffect(() => {
    if (itemsReady) setBasket((prev) => pruneBasket(prev, itemsById))
  }, [itemsById, itemsReady])

  const toggle = useCallback((id) => {
    setBasket((prev) => (prev[id] ? setQuantity(prev, id, 0) : addToBasket(prev, [id])))
  }, [])

  const addMany = useCallback((ids) => setBasket((prev) => addToBasket(prev, ids)), [])
  const setQty = useCallback((id, qty) => setBasket((prev) => setQuantity(prev, id, qty)), [])
  // Sobre la cantidad más reciente: dos toques seguidos en «+» suman dos.
  const step = useCallback((id, delta) => setBasket((prev) => setQuantity(prev, id, Math.max(1, (prev[id] ?? 0) + delta))), [])
  const clear = useCallback(() => setBasket({}), [])

  return {
    basket,
    picking,
    setPicking,
    toggle,
    addMany,
    setQty,
    step,
    clear,
  }
}
