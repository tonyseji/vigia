import { formatPrice } from './format.js'
import { displayTitle, stockLabel } from './itemText.js'

/** Texto de un artículo listo para pegar en una conversación con Claude
 * (docs/DECISIONES.md 2026-09-06, "Las ideas de búsqueda visual..."). */
export function itemToText(item) {
  const stock = item.itm_price != null ? stockLabel(item) : null
  const price = stock ? `${formatPrice(item.itm_price)} · ${stock}` : formatPrice(item.itm_price)
  const lines = [displayTitle(item), price, item.itm_url]
  if (item.itm_image_url) lines.push(item.itm_image_url)
  return lines.join('\n')
}

export function folderToText(folderName, items) {
  const header = `${folderName} (${items.length} artículo${items.length === 1 ? '' : 's'})`
  return [header, '', ...items.map((item) => itemToText(item))].join('\n\n')
}

/** Copia al portapapeles; no lanza si el navegador no lo soporta. */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
