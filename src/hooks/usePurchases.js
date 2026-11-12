import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { useReloadOnReturn } from './useReloadOnReturn.js'

/** Valida lo que teclea el usuario. Devuelve un texto de error o null. */
function validate({ title, amount }) {
  if (!String(title ?? '').trim()) return 'Pon qué has comprado.'
  const n = typeof amount === 'string' ? Number(amount.replace(',', '.')) : amount
  if (amount === '' || amount == null || !Number.isFinite(n) || n < 0) return 'Pon un importe válido (0 o más).'
  return null
}

const toAmount = (amount) => (typeof amount === 'string' ? Number(amount.replace(',', '.')) : amount)

/** Campos del formulario -> columnas. Solo las claves presentes. */
function toRow(fields) {
  const row = {}
  if ('title' in fields) row.pur_title = String(fields.title).trim()
  if ('amount' in fields) row.pur_amount = toAmount(fields.amount)
  if ('date' in fields) row.pur_date = fields.date
  if ('store' in fields) row.pur_store = String(fields.store ?? '').trim() || null
  if ('notes' in fields) row.pur_notes = String(fields.notes ?? '').trim() || null
  if ('folderId' in fields) row.pur_fld_id = fields.folderId ?? null
  return row
}

/** Compras del usuario y las de carpetas compartidas con él (RLS, migración
 * 026). `pur_usr_id` lo pone la BD. */
export function usePurchases() {
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  // Mismo criterio que useItems: un fallo de lectura avisa, no vacía.
  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from('purchases')
      .select('*')
      .order('pur_date', { ascending: false })
      .order('pur_created_at', { ascending: false })
    if (!error) setPurchases(data ?? [])
    setLoadError(Boolean(error))
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])
  useReloadOnReturn(reload)

  const addPurchase = useCallback(async (fields) => {
    const invalid = validate(fields)
    if (invalid) return { error: invalid }
    const { error } = await supabase.from('purchases').insert({ pur_currency: 'EUR', ...toRow(fields) })
    if (error) return { error: 'No se pudo guardar la compra.' }
    await reload()
    return {}
  }, [reload])

  const updatePurchase = useCallback(async (id, changes) => {
    const invalid = validate({ title: 'title' in changes ? changes.title : 'x', amount: 'amount' in changes ? changes.amount : 0 })
    if (invalid) return { error: invalid }
    const row = toRow(changes)
    if (Object.keys(row).length === 0) return {}
    const { error } = await supabase.from('purchases').update(row).eq('pur_id', id)
    if (error) return { error: 'No se pudo guardar el cambio.' }
    await reload()
    return {}
  }, [reload])

  /** Borra la compra; si venía de un artículo, éste vuelve a vigilarse. */
  const deletePurchase = useCallback(async (id) => {
    const purchase = purchases.find((p) => p.pur_id === id)
    const { error } = await supabase.from('purchases').delete().eq('pur_id', id)
    if (error) return { error: 'No se pudo borrar la compra.' }
    if (purchase?.pur_itm_id) {
      const { error: itemError } = await supabase
        .from('items')
        .update({ itm_bought_at: null })
        .eq('itm_id', purchase.pur_itm_id)
      if (itemError) {
        await reload()
        return { error: 'Se borró la compra, pero el artículo no volvió a vigilarse. Pulsa «Deshacer» en él.' }
      }
    }
    await reload()
    return {}
  }, [purchases, reload])

  /** «Comprado» sobre un artículo: crea la compra y deja de vigilarlo. Si el
   * segundo paso falla, la compra recién creada se borra. */
  const markItemBought = useCallback(async (item, fields) => {
    const invalid = validate(fields)
    if (invalid) return { error: invalid }
    const { data: created, error } = await supabase
      .from('purchases')
      .insert({
        pur_currency: item.itm_currency ?? 'EUR',
        ...toRow(fields),
        pur_itm_id: item.itm_id,
        pur_fld_id: fields.folderId ?? null,
      })
      .select('pur_id')
      .single()
    if (error) return { error: 'No se pudo guardar la compra.' }
    const { error: itemError } = await supabase
      .from('items')
      .update({ itm_bought_at: new Date().toISOString() })
      .eq('itm_id', item.itm_id)
    if (itemError) {
      await supabase.from('purchases').delete().eq('pur_id', created.pur_id)
      await reload()
      return { error: 'No se pudo marcar el artículo como comprado.' }
    }
    await reload()
    return {}
  }, [reload])

  /** Deshace «Comprado»: borra las compras de ese artículo y lo vuelve a vigilar. */
  const undoItemBought = useCallback(async (itemId) => {
    const { error } = await supabase.from('purchases').delete().eq('pur_itm_id', itemId)
    if (error) return { error: 'No se pudo deshacer la compra.' }
    const { error: itemError } = await supabase.from('items').update({ itm_bought_at: null }).eq('itm_id', itemId)
    if (itemError) {
      await reload()
      return { error: 'Se borró la compra, pero el artículo no volvió a vigilarse. Inténtalo de nuevo.' }
    }
    await reload()
    return {}
  }, [reload])

  return { purchases, loading, loadError, addPurchase, updatePurchase, deletePurchase, markItemBought, undoItemBought, reload }
}
