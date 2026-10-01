import { describe, it, expect } from 'vitest'
import { NO_FOLDER, folderGroupName, groupByFolder, loadView, saveView, loadCollapsed, saveCollapsed } from '../itemGroups.js'

const foldersById = {
  m: { fld_id: 'm', fld_name: 'Muebles', fld_parent_id: null },
  s: { fld_id: 's', fld_name: 'Salón', fld_parent_id: 'm' },
  a: { fld_id: 'a', fld_name: 'Audio', fld_parent_id: null },
}

const item = (id, fld) => ({ itm_id: id, itm_fld_id: fld })

describe('groupByFolder', () => {
  it('pone «Sin carpeta» primero y el resto por nombre', () => {
    const groups = groupByFolder([item(1, 'm'), item(2, null), item(3, 'a'), item(4, 's'), item(5, null)], foldersById)
    expect(groups.map(([key]) => folderGroupName(key, foldersById))).toEqual([
      'Sin carpeta',
      'Audio',
      'Muebles',
      'Muebles / Salón',
    ])
    expect(groups[0][1].map((i) => i.itm_id)).toEqual([2, 5])
  })

  it('una carpeta desconocida cae en «Sin carpeta», sin grupo repetido', () => {
    const groups = groupByFolder([item(1, 'x'), item(2, null)], foldersById)
    expect(groups).toHaveLength(1)
    expect(groups[0][0]).toBe(NO_FOLDER)
    expect(groups[0][1].map((i) => i.itm_id)).toEqual([1, 2])
  })
})

function memoryStorage() {
  const data = {}
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v)
    },
  }
}

const broken = {
  getItem: () => {
    throw new Error('bloqueado')
  },
  setItem: () => {
    throw new Error('bloqueado')
  },
}

describe('vista recordada', () => {
  it('guarda Fotos y la recupera; por defecto Lista', () => {
    const storage = memoryStorage()
    expect(loadView(storage)).toBe('list')
    saveView('photos', storage)
    expect(loadView(storage)).toBe('photos')
  })

  it('ignora valores raros y no rompe sin almacenamiento', () => {
    const storage = memoryStorage()
    storage.setItem('vigia.itemView', 'mosaico')
    expect(loadView(storage)).toBe('list')
    expect(loadView(broken)).toBe('list')
    expect(() => saveView('photos', broken)).not.toThrow()
  })
})

describe('grupos plegados', () => {
  it('se guardan y se recuperan', () => {
    const storage = memoryStorage()
    expect(loadCollapsed(storage)).toEqual(new Set())
    saveCollapsed(new Set(['m', NO_FOLDER]), storage)
    expect(loadCollapsed(storage)).toEqual(new Set(['m', NO_FOLDER]))
  })

  it('ignora basura y no rompe sin almacenamiento', () => {
    const storage = memoryStorage()
    storage.setItem('vigia.collapsedGroups', '{no es json')
    expect(loadCollapsed(storage)).toEqual(new Set())
    storage.setItem('vigia.collapsedGroups', JSON.stringify(['a', 3, null]))
    expect(loadCollapsed(storage)).toEqual(new Set(['a']))
    expect(loadCollapsed(broken)).toEqual(new Set())
    expect(() => saveCollapsed(new Set(['a']), broken)).not.toThrow()
  })
})

