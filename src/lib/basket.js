/** Cesta: marcas artículos (de cualquier carpeta y tienda) y ves cuánto
 * costaría todo junto (docs/superpowers/specs/2026-10-03-cesta-design.md).
 * La cesta es `{ itm_id: cantidad }` y vive en este navegador, no en la BD. */

const STORAGE_KEY = 'vigia.cesta'

const round2 = (n) => Math.round(n * 100) / 100

/** Dominio de la tienda, sin www. Si no es una URL, la devuelve tal cual. */
export function storeOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** [{ item, qty }] en el orden de la cesta, saltando artículos que no hay. */
export function basketLines(basket, itemsById) {
  return Object.entries(basket)
    .filter(([id]) => itemsById[id])
    .map(([id, qty]) => ({ item: itemsById[id], qty }))
}

function historyPrices(item) {
  return (item.price_history ?? []).map((h) => h.ph_price).filter((p) => p != null)
}

/** Vendido o sin stock en la última lectura: no se puede comprar. */
const unavailable = (item) => item.itm_in_stock === false

/** Totales de la cesta. «Al guardarlos» usa el primer precio registrado de
 * cada artículo (el mismo que la variación de cada fila); «mínimo» el más
 * bajo registrado. Los artículos sin precio y los vendidos o sin stock (B27)
 * no suman ninguna de las tres: se cuentan aparte. */
export function basketSummary(lines) {
  let units = 0
  let total = 0
  let totalThen = 0
  let totalMin = 0
  let unpriced = 0
  let unavailableCount = 0
  const stores = new Set()
  for (const { item, qty } of lines) {
    units += qty
    stores.add(storeOf(item.itm_url))
    if (item.itm_price == null) {
      unpriced += 1
      continue
    }
    if (unavailable(item)) {
      unavailableCount += 1
      continue
    }
    const history = historyPrices(item)
    total += item.itm_price * qty
    totalThen += (history[0] ?? item.itm_price) * qty
    totalMin += Math.min(item.itm_price, ...history) * qty
  }
  return {
    units,
    total: round2(total),
    totalThen: round2(totalThen),
    totalMin: round2(totalMin),
    unpriced,
    unavailable: unavailableCount,
    stores: stores.size,
  }
}

/** [{ store, lines, subtotal }], la tienda con más importe primero: es la
 * que más pesa en la decisión y la que más envío puede cobrar. */
export function groupByStore(lines) {
  const groups = new Map()
  for (const line of lines) {
    const store = storeOf(line.item.itm_url)
    if (!groups.has(store)) groups.set(store, { store, lines: [], subtotal: 0 })
    const group = groups.get(store)
    group.lines.push(line)
    if (!unavailable(line.item)) group.subtotal = round2(group.subtotal + (line.item.itm_price ?? 0) * line.qty)
  }
  return [...groups.values()].sort((a, b) => b.subtotal - a.subtotal || a.store.localeCompare(b.store, 'es'))
}

/** Mete los artículos con cantidad 1; los que ya estaban no cambian. */
export function addToBasket(basket, ids) {
  const next = { ...basket }
  for (const id of ids) if (!next[id]) next[id] = 1
  return next
}

/** Cambia la cantidad; 0 o menos lo saca de la cesta. */
export function setQuantity(basket, id, qty) {
  const next = { ...basket }
  if (qty > 0) next[id] = qty
  else delete next[id]
  return next
}

/** Saca los artículos que ya no existen (borrados). Si no sobra nada,
 * devuelve la misma cesta para no guardar ni repintar en balde. */
export function pruneBasket(basket, itemsById) {
  const ids = Object.keys(basket)
  if (ids.every((id) => itemsById[id])) return basket
  return Object.fromEntries(ids.filter((id) => itemsById[id]).map((id) => [id, basket[id]]))
}

function defaultStorage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function loadBasket(storage = defaultStorage()) {
  try {
    const raw = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '{}')
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    return Object.fromEntries(Object.entries(raw).filter(([, qty]) => Number.isInteger(qty) && qty > 0))
  } catch {
    return {}
  }
}

export function saveBasket(basket, storage = defaultStorage()) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(basket))
  } catch {
    // Sin almacenamiento (modo privado): la cesta dura lo que la pestaña.
  }
}
