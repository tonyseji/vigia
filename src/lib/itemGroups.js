/** Agrupación por carpeta de la vista general (ItemList), y lo que se
 * recuerda en este navegador: la vista elegida (Lista / Fotos) y qué grupos
 * están plegados. */

export const NO_FOLDER = '__none__'

/** Vigía admite carpeta, subcarpeta y una más dentro (Pisito / Dormitorio /
 * Camas). El tope lo pone el trigger de la migración 025; aquí solo decide
 * dónde se ofrece «Nueva subcarpeta». */
export const MAX_FOLDER_LEVELS = 3

/** Nombre del grupo con la jerarquía visible: "Muebles / Salón / Sofás" en
 * una subcarpeta, o solo "Muebles" si es de primer nivel. Un padre que no
 * está cargado no sale en el nombre. */
export function folderGroupName(key, foldersById) {
  const folder = key === NO_FOLDER ? null : foldersById[key]
  if (!folder) return 'Sin carpeta'
  const names = [folder.fld_name]
  const seen = new Set([folder.fld_id])
  for (let parent = foldersById[folder.fld_parent_id]; parent && !seen.has(parent.fld_id); parent = foldersById[parent.fld_parent_id]) {
    seen.add(parent.fld_id)
    names.unshift(parent.fld_name)
  }
  return names.join(' / ')
}

/** Carpetas en el orden del sidebar: cada carpeta seguida de sus
 * subcarpetas (y estas de las suyas), y dentro de cada nivel el orden en que
 * llegan (fld_order). La BD las da en orden de creación, así que una
 * subcarpeta creada después de otra carpeta raíz salía debajo de esa raíz en
 * los selectores. Cada una lleva `depth` (0 = primer nivel) para sangrarla.
 * Una subcarpeta cuya carpeta no está cargada va al final, no se pierde. */
export function foldersInTreeOrder(folders) {
  const ids = new Set(folders.map((f) => f.fld_id))
  const childrenOf = {}
  for (const f of folders) {
    if (f.fld_parent_id != null) (childrenOf[f.fld_parent_id] = childrenOf[f.fld_parent_id] || []).push(f)
  }
  const ordered = []
  const placed = new Set()
  const walk = (f, depth) => {
    if (placed.has(f.fld_id)) return
    placed.add(f.fld_id)
    ordered.push({ ...f, depth })
    for (const child of childrenOf[f.fld_id] ?? []) walk(child, depth + 1)
  }
  for (const f of folders) if (f.fld_parent_id == null) walk(f, 0)
  for (const f of folders) if (f.fld_parent_id != null && !ids.has(f.fld_parent_id)) walk(f, 0)
  return ordered
}

/** La carpeta y todo lo que cuelga de ella, a cualquier nivel: lo que se ve
 * al seleccionarla y lo que entra en la cesta desde su menú. */
export function folderSubtreeIds(folderId, folders) {
  const ids = new Set([folderId])
  let grew = true
  while (grew) {
    grew = false
    for (const f of folders) {
      if (f.fld_parent_id != null && ids.has(f.fld_parent_id) && !ids.has(f.fld_id)) {
        ids.add(f.fld_id)
        grew = true
      }
    }
  }
  return ids
}

/** [clave, artículos] por carpeta, respetando el orden en que llegan los
 * artículos. «Sin carpeta» va siempre primero (lo recién guardado suele
 * estar ahí); el resto, por nombre. Un artículo de una carpeta que no está
 * cargada cae en «Sin carpeta» en vez de abrir un segundo grupo con el
 * mismo nombre. */
/** El grupo de un artículo: su carpeta, o «Sin carpeta» si no tiene o ya
 * no la ve (carpeta borrada o compartida que se dejó). */
export function groupKeyOf(item, foldersById) {
  return item.itm_fld_id && foldersById[item.itm_fld_id] ? item.itm_fld_id : NO_FOLDER
}

/** Lo que costaría todo junto, como el total de la cesta (lib/basket.js):
 * sin precio y vendido o sin stock (B27) no suman. */
export function itemsTotal(items) {
  const total = items.reduce((sum, i) => (i.itm_price == null || i.itm_in_stock === false ? sum : sum + i.itm_price), 0)
  return Math.round(total * 100) / 100
}

/** Los favoritos delante, sin cambiar el orden elegido dentro de cada parte
 * (docs/DECISIONES.md 2026-10-16). Como groupByFolder respeta el orden en
 * que llegan, también quedan delante dentro de cada carpeta. */
export function favoritesFirst(items) {
  return [...items.filter((i) => i.isFavorite), ...items.filter((i) => !i.isFavorite)]
}

export function groupByFolder(items, foldersById) {
  const groups = {}
  for (const item of items) {
    const key = groupKeyOf(item, foldersById)
    ;(groups[key] = groups[key] || []).push(item)
  }
  return Object.entries(groups).sort(([a], [b]) => {
    if (a === NO_FOLDER) return -1
    if (b === NO_FOLDER) return 1
    return folderGroupName(a, foldersById).localeCompare(folderGroupName(b, foldersById), 'es')
  })
}

const VIEW_KEY = 'vigia.itemView'
const VIEWS = ['list', 'photos']

function defaultStorage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function loadView(storage = defaultStorage()) {
  try {
    const view = storage?.getItem(VIEW_KEY)
    return VIEWS.includes(view) ? view : 'list'
  } catch {
    return 'list'
  }
}

export function saveView(view, storage = defaultStorage()) {
  try {
    storage?.setItem(VIEW_KEY, view)
  } catch {
    // Sin almacenamiento (modo privado): la vista vuelve a Lista al recargar.
  }
}

const COLLAPSED_KEY = 'vigia.collapsedGroups'

/** Claves de los grupos plegados (ids de carpeta o NO_FOLDER). */
export function loadCollapsed(storage = defaultStorage()) {
  try {
    const list = JSON.parse(storage?.getItem(COLLAPSED_KEY) ?? '[]')
    return new Set(Array.isArray(list) ? list.filter((k) => typeof k === 'string') : [])
  } catch {
    return new Set()
  }
}

export function saveCollapsed(collapsed, storage = defaultStorage()) {
  try {
    storage?.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]))
  } catch {
    // Sin almacenamiento: los grupos vuelven a salir abiertos al recargar.
  }
}
