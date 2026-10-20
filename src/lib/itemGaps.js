// Lo principal de un artículo es precio, foto y nombre. Al que le falta
// algo, volver a añadirlo lo completa en vez de decir que ya está
// (docs/DECISIONES.md 2026-10-21). Copiado en
// supabase/functions/save-link/link.ts: si se cambia aquí, allí también.

const LABELS = { precio: 'el precio', foto: 'la foto', nombre: 'el nombre' }

/** Lo que le falta: 'precio', 'foto', 'nombre'. Uno guardado sin leer la
 * ficha lleva la dirección de título (src/lib/itemText.js). */
export function missingParts(item) {
  const parts = []
  if (item.itm_price == null) parts.push('precio')
  if (!item.itm_image_url) parts.push('foto')
  if (!item.itm_title || item.itm_title === item.itm_url) parts.push('nombre')
  return parts
}

/** «el precio, la foto y el nombre». */
export function missingText(parts) {
  const words = parts.map((p) => LABELS[p])
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} y ${words.at(-1)}` : (words[0] ?? '')
}

/** Campos que rellena una lectura nueva de la ficha (lo que devuelve scrape).
 * Título y foto solo si faltaban: lo editado no se pisa (como itemUpdate en
 * record-price/record.ts). Un precio leído es un precio más: deja de ser
 * manual, porque la tienda sí se ha dejado leer. Vacío si no aporta nada. */
export function fillUpdate(existing, read, now) {
  const update = {}
  if (read.price != null) {
    update.itm_price = read.price
    update.itm_in_stock = read.inStock ?? null
    update.itm_is_manual = false
    update.itm_last_checked_at = now
    update.itm_last_error = null
    // Mismo criterio que refresh: si sube por encima del último aviso, la
    // próxima bajada vuelve a avisar (notify.ts, resetsNotified).
    if (existing.itm_notified_price != null && read.price > existing.itm_notified_price) {
      update.itm_notified_price = null
      update.itm_notified_at = null
    }
  }
  if (read.title && (!existing.itm_title || existing.itm_title === existing.itm_url)) update.itm_title = read.title
  if (read.image && !existing.itm_image_url) update.itm_image_url = read.image
  return update
}
