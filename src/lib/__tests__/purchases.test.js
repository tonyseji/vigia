import { describe, it, expect } from 'vitest'
import {
  purchaseDraftFromItem,
  purchasesTotal,
  purchasesInFolder,
  groupPurchasesByFolder,
  purchaseYears,
  purchasesInYear,
  paidVsLowest,
} from '../purchases.js'
import { NO_FOLDER } from '../itemGroups.js'

const folders = [
  { fld_id: 'z', fld_name: 'Zeta', fld_parent_id: null },
  { fld_id: 'p', fld_name: 'Pisito', fld_parent_id: null },
  { fld_id: 'd', fld_name: 'Dormitorio', fld_parent_id: 'p' },
  { fld_id: 'c', fld_name: 'Camas', fld_parent_id: 'd' },
]
const buy = (id, amount, fld = null, date = '2026-05-01') => ({
  pur_id: id,
  pur_amount: amount,
  pur_fld_id: fld,
  pur_date: date,
})

describe('purchaseDraftFromItem', () => {
  it('precarga título, precio, tienda sin www, fecha y carpeta', () => {
    const item = { itm_title: 'Cama', itm_price: 199.9, itm_url: 'https://www.ikea.com/es/p/cama', itm_fld_id: 'c' }
    expect(purchaseDraftFromItem(item, '2026-11-12')).toEqual({
      title: 'Cama',
      amount: 199.9,
      store: 'ikea.com',
      date: '2026-11-12',
      notes: '',
      folderId: 'c',
    })
  })
  it('sin carpeta, sin precio y sin url', () => {
    const d = purchaseDraftFromItem({ itm_title: 'X', itm_price: null, itm_url: null }, '2026-01-01')
    expect(d.folderId).toBeNull()
    expect(d.amount).toBe('')
    expect(d.store).toBe('')
  })
  it('url inválida da tienda vacía', () => {
    expect(purchaseDraftFromItem({ itm_title: 'X', itm_url: 'no es url' }, 'd').store).toBe('')
  })
})

describe('purchasesTotal', () => {
  it('0,1 + 0,2 es 0,3', () => {
    expect(purchasesTotal([buy(1, 0.1), buy(2, 0.2)])).toBe(0.3)
  })
  it('vacío es 0 y acepta importes como texto de numeric', () => {
    expect(purchasesTotal([])).toBe(0)
    expect(purchasesTotal([buy(1, '10.50'), buy(2, '0.05')])).toBe(10.55)
  })
})

describe('purchasesInFolder', () => {
  const all = [buy(1, 1, 'p'), buy(2, 2, 'd'), buy(3, 3, 'c'), buy(4, 4, 'z'), buy(5, 5, null)]
  it('null devuelve todas', () => {
    expect(purchasesInFolder(all, null, folders)).toHaveLength(5)
  })
  it('incluye subcarpetas a tres niveles', () => {
    expect(purchasesInFolder(all, 'p', folders).map((p) => p.pur_id)).toEqual([1, 2, 3])
    expect(purchasesInFolder(all, 'd', folders).map((p) => p.pur_id)).toEqual([2, 3])
    expect(purchasesInFolder(all, 'c', folders).map((p) => p.pur_id)).toEqual([3])
  })
  it('las sin carpeta no entran en una carpeta', () => {
    expect(purchasesInFolder(all, 'z', folders).map((p) => p.pur_id)).toEqual([4])
  })
})

describe('groupPurchasesByFolder', () => {
  it('orden de árbol, nombre con jerarquía, totales y Sin carpeta al final', () => {
    const groups = groupPurchasesByFolder(
      [buy(1, 0.1, null), buy(2, 0.2, 'c'), buy(3, 5, 'z'), buy(4, 0.2, 'c'), buy(5, 1, 'p')],
      folders,
    )
    expect(groups.map((g) => g.key)).toEqual(['z', 'p', 'c', NO_FOLDER])
    expect(groups.map((g) => g.name)).toEqual(['Zeta', 'Pisito', 'Pisito / Dormitorio / Camas', 'Sin carpeta'])
    expect(groups[2].total).toBe(0.4)
    expect(groups[2].purchases).toHaveLength(2)
  })
  it('una carpeta que no se ve cae en Sin carpeta', () => {
    const groups = groupPurchasesByFolder([buy(1, 1, 'borrada'), buy(2, 2, null)], folders)
    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBe(NO_FOLDER)
    expect(groups[0].total).toBe(3)
  })
  it('sin compras no hay grupos', () => {
    expect(groupPurchasesByFolder([], folders)).toEqual([])
  })
})

describe('años', () => {
  const list = [buy(1, 1, null, '2025-12-31'), buy(2, 1, null, '2026-01-01'), buy(3, 1, null, '2026-06-10'), buy(4, 1, null, '2024-03-03')]
  it('purchaseYears: sin repetir, más reciente primero', () => {
    expect(purchaseYears(list)).toEqual([2026, 2025, 2024])
    expect(purchaseYears([])).toEqual([])
  })
  it('purchasesInYear filtra y null devuelve todas', () => {
    expect(purchasesInYear(list, 2026).map((p) => p.pur_id)).toEqual([2, 3])
    expect(purchasesInYear(list, 2025).map((p) => p.pur_id)).toEqual([1])
    expect(purchasesInYear(list, null)).toHaveLength(4)
    expect(purchasesInYear(list, 1999)).toEqual([])
  })
})

describe('paidVsLowest', () => {
  it('diferencia con el mínimo, sin errores de coma flotante', () => {
    expect(paidVsLowest({ pur_amount: 0.3 }, { itm_min_price: 0.1 })).toBe(0.2)
    expect(paidVsLowest({ pur_amount: 90 }, { itm_min_price: 100 })).toBe(-10)
    expect(paidVsLowest({ pur_amount: 100 }, { itm_min_price: 100 })).toBe(0)
  })
  it('null sin artículo o sin mínimo', () => {
    expect(paidVsLowest({ pur_amount: 5 }, null)).toBeNull()
    expect(paidVsLowest({ pur_amount: 5 }, { itm_min_price: null })).toBeNull()
    expect(paidVsLowest({ pur_amount: 5 }, {})).toBeNull()
  })
})
