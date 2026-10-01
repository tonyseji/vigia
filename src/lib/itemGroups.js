/** Agrupación por carpeta de la vista general (ItemList) y la vista elegida
 * (Lista / Fotos), que se recuerda en este navegador. */

export const NO_FOLDER = '__none__'

/** Nombre del grupo con la jerarquía visible: "Muebles / Salón" si es una
 * subcarpeta, o solo "Muebles" si es de primer nivel. */
export function folderGroupName(key, foldersById) {
  const folder = key === NO_FOLDER ? null : foldersById[key]
  if (!folder) return 'Sin carpeta'
  const parent = folder.fld_parent_id ? foldersById[folder.fld_parent_id] : null
  return parent ? `${parent.fld_name} / ${folder.fld_name}` : folder.fld_name
}

/** [clave, artículos] por carpeta, respetando el orden en que llegan los
 * artículos. «Sin carpeta» va siempre primero (lo recién guardado suele
 * estar ahí); el resto, por nombre. Un artículo de una carpeta que no está
 * cargada cae en «Sin carpeta» en vez de abrir un segundo grupo con el
 * mismo nombre. */
export function groupByFolder(items, foldersById) {
  const groups = {}
  for (const item of items) {
    const key = item.itm_fld_id && foldersById[item.itm_fld_id] ? item.itm_fld_id : NO_FOLDER
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
