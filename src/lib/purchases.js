/** Funciones puras de las compras (docs/superpowers/specs/2026-11-12-compras-design.md).
 * Los importes se suman en céntimos para no arrastrar errores de coma flotante
 * (0,1 + 0,2). */
import { NO_FOLDER, folderGroupName, folderSubtreeIds, foldersInTreeOrder } from './itemGroups.js'

const cents = (amount) => Math.round((Number(amount) || 0) * 100)

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** Compra precargada desde un artículo vigilado: precio actual (editable),
 * tienda sacada de la dirección y su carpeta. `today` es YYYY-MM-DD. */
export function purchaseDraftFromItem(item, today) {
  return {
    title: item.itm_title ?? '',
    amount: item.itm_price ?? '',
    store: item.itm_url ? domainOf(item.itm_url) : '',
    date: today,
    notes: '',
    folderId: item.itm_fld_id ?? null,
  }
}

export function purchasesTotal(purchases) {
  return purchases.reduce((sum, p) => sum + cents(p.pur_amount), 0) / 100
}

/** La carpeta y todo lo que cuelga de ella; `null` = todas. */
export function purchasesInFolder(purchases, folderId, folders) {
  if (folderId == null) return purchases
  const ids = folderSubtreeIds(folderId, folders)
  return purchases.filter((p) => p.pur_fld_id != null && ids.has(p.pur_fld_id))
}

/** [{ key, name, purchases, total }] en orden de árbol; «Sin carpeta» al
 * final. Una compra de una carpeta que no se ve cae en «Sin carpeta». Solo
 * salen los grupos con compras. */
export function groupPurchasesByFolder(purchases, folders) {
  const foldersById = Object.fromEntries(folders.map((f) => [f.fld_id, f]))
  const groups = new Map()
  for (const p of purchases) {
    const key = p.pur_fld_id && foldersById[p.pur_fld_id] ? p.pur_fld_id : NO_FOLDER
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(p)
  }
  const order = [...foldersInTreeOrder(folders).map((f) => f.fld_id), NO_FOLDER]
  return order
    .filter((key) => groups.has(key))
    .map((key) => ({
      key,
      name: folderGroupName(key, foldersById),
      purchases: groups.get(key),
      total: purchasesTotal(groups.get(key)),
    }))
}

const yearOf = (p) => Number(String(p.pur_date ?? '').slice(0, 4))

/** Años con compras, el más reciente primero. */
export function purchaseYears(purchases) {
  const years = new Set(purchases.map(yearOf).filter((y) => Number.isFinite(y) && y > 0))
  return [...years].sort((a, b) => b - a)
}

/** `year` null = todos los años. */
export function purchasesInYear(purchases, year) {
  if (year == null) return purchases
  return purchases.filter((p) => yearOf(p) === Number(year))
}

/** Lo pagado menos el mínimo histórico del artículo (positivo = se pagó por
 * encima del mínimo). `null` si no hay artículo o mínimo. */
export function paidVsLowest(purchase, item) {
  if (!item || item.itm_min_price == null || purchase?.pur_amount == null) return null
  return (cents(purchase.pur_amount) - cents(item.itm_min_price)) / 100
}
