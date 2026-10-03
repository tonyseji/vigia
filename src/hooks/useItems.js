import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { useReloadOnReturn } from './useReloadOnReturn.js'
import { cleanUrl, findSameItem } from '../lib/urlKey.js'

function domainOf(url) {
  return new URL(url).hostname.replace(/^www\./, '')
}

/** Con el título: la dirección pegada puede no parecerse a la guardada, y
 * puede haberla guardado otra persona en una carpeta compartida. */
function duplicateMessage(item) {
  const title = item.itm_title && item.itm_title !== item.itm_url ? `: «${item.itm_title}»` : ''
  return `Ese artículo ya está en tu lista${title}.`
}

/** Items del usuario con su histórico de precios, y las acciones para
 * añadir uno nuevo (con el aviso de tienda bloqueada) y refrescar todos. */
export function useItems() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState(false)

  // Mismo criterio que useFolders: un fallo de lectura avisa, no vacía (B16).
  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from('items')
      .select('*, price_history(ph_price, ph_checked_at, ph_source)')
      .order('itm_created_at', { ascending: false })
    if (!error) {
      setItems(
        (data ?? []).map((item) => ({
          ...item,
          price_history: [...item.price_history].sort(
            (a, b) => new Date(a.ph_checked_at) - new Date(b.ph_checked_at),
          ),
        })),
      )
    }
    setLoadError(Boolean(error))
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])
  useReloadOnReturn(reload)

  /**
   * Añade un artículo. Antes de nada consulta store_rules por dominio; si
   * está bloqueada, no llama a scrape y devuelve { blocked: true } para que
   * el formulario ofrezca guardarlo en modo manual (docs/ARQUITECTURA.md).
   */
  const checkBlocked = useCallback(async (url) => {
    const domain = domainOf(url)
    const { data } = await supabase
      .from('store_rules')
      .select('sr_blocked')
      .eq('sr_domain', domain)
      .maybeSingle()
    return Boolean(data?.sr_blocked)
  }, [])

  /** El artículo que ya sea esta dirección, aunque no se escriba igual
   * (src/lib/urlKey.js). Entre todo lo que el usuario ve: los suyos y los de
   * carpetas compartidas con él (RLS, migración 016). El índice único es por
   * usuario y no frena que el invitado guarde lo que ya tiene el dueño en la
   * carpeta compartida (sesión 29). Si está en las dos, gana el propio. */
  const findExisting = useCallback(async (urls) => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user.id
    const { data, error } = await supabase
      .from('items')
      .select('itm_id, itm_usr_id, itm_url, itm_title, itm_image_url, itm_price')
    if (error) return { error: 'No se pudo comprobar tu lista. Inténtalo de nuevo.' }
    const visible = data ?? []
    const existing =
      findSameItem(visible.filter((i) => i.itm_usr_id === userId), urls) ?? findSameItem(visible, urls)
    return { userId, existing }
  }, [])

  const addItem = useCallback(async (rawUrl, folderId = null) => {
    const url = cleanUrl(rawUrl)
    // Antes de leer el precio: si ya está, no se gasta una lectura.
    const found = await findExisting([url])
    if (found.error) return { error: found.error }
    if (found.existing) return { error: duplicateMessage(found.existing) }
    const blocked = await checkBlocked(url)
    if (blocked) return { blocked: true }

    const { data: fnData, error: fnError } = await supabase.functions.invoke('scrape', {
      body: { url },
    })
    if (fnError) return { error: 'No se pudo leer el precio. Inténtalo de nuevo.' }
    if (fnData?.blocked) return { blocked: true }
    if (fnData?.error) return { error: fnData.error }

    const { data: item, error: insertError } = await supabase
      .from('items')
      .insert({
        itm_usr_id: found.userId,
        itm_fld_id: folderId,
        itm_url: url,
        itm_title: fnData?.title ?? url,
        itm_image_url: fnData?.image ?? null,
        itm_price: fnData?.price ?? null,
        itm_currency: fnData?.currency ?? 'EUR',
        itm_in_stock: fnData?.inStock ?? null,
        itm_last_checked_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (insertError) {
      return insertError.code === '23505'
        ? { error: 'Ese artículo ya está en tu lista.' }
        : { error: 'No se pudo guardar el artículo.' }
    }

    if (fnData?.price != null) {
      await supabase.from('price_history').insert({
        ph_itm_id: item.itm_id,
        ph_price: fnData.price,
        ph_in_stock: fnData.inStock ?? null,
        ph_source: 'auto',
      })
    }

    await reload()
    return { item }
  }, [checkBlocked, findExisting, reload])

  /** Guarda un artículo bloqueado en modo manual, con el precio que teclee el usuario. */
  const addManualItem = useCallback(async (rawUrl, price, folderId = null) => {
    const url = cleanUrl(rawUrl)
    const found = await findExisting([url])
    if (found.error) return { error: found.error }
    if (found.existing) return { error: duplicateMessage(found.existing) }
    const { data: item, error } = await supabase
      .from('items')
      .insert({
        itm_usr_id: found.userId,
        itm_fld_id: folderId,
        itm_url: url,
        itm_title: url,
        itm_price: price ?? null,
        itm_is_manual: true,
        itm_last_checked_at: price != null ? new Date().toISOString() : null,
      })
      .select()
      .single()
    if (error) {
      return error.code === '23505'
        ? { error: 'Ese artículo ya está en tu lista.' }
        : { error: 'No se pudo guardar el artículo.' }
    }
    if (price != null) {
      await supabase.from('price_history').insert({
        ph_itm_id: item.itm_id,
        ph_price: price,
        ph_source: 'manual',
      })
    }
    await reload()
    return { item }
  }, [findExisting, reload])

  /** Guarda lo que manda el botón del navegador (src/lib/browserImport.js).
   * Si el artículo ya está en la lista, solo apunta el precio nuevo (y
   * rellena título e imagen si se guardó a mano y no los tenía). Si no,
   * lo crea. */
  const saveFromBrowser = useCallback(async (data, folderId = null) => {
    const url = cleanUrl(data.url)
    // Se busca por la canónica y por la de la barra: el artículo pudo
    // guardarse pegando cualquiera de las dos.
    const now = new Date().toISOString()
    const found = await findExisting([url, data.altUrl && cleanUrl(data.altUrl)].filter(Boolean))
    if (found.error) return { error: found.error }
    const { userId, existing } = found
    // Tienda bloqueada = el pase automático no puede leerla: queda en modo
    // manual (etiqueta «sin precio automático»), también si ya existía.
    const manual = await checkBlocked(url)

    let itemId = existing?.itm_id
    if (existing) {
      const { error } = await supabase
        .from('items')
        .update({
          itm_price: data.price,
          itm_in_stock: data.inStock,
          itm_last_checked_at: now,
          itm_last_error: null,
          itm_is_manual: manual,
          ...(existing.itm_title === existing.itm_url ? { itm_title: data.title } : {}),
          ...(!existing.itm_image_url && data.image ? { itm_image_url: data.image } : {}),
        })
        .eq('itm_id', itemId)
      if (error) return { error: 'No se pudo guardar el precio.' }
    } else {
      const { data: item, error } = await supabase
        .from('items')
        .insert({
          itm_usr_id: userId,
          itm_fld_id: folderId,
          itm_url: url,
          itm_title: data.title,
          itm_image_url: data.image,
          itm_price: data.price,
          itm_currency: data.currency,
          itm_in_stock: data.inStock,
          itm_is_manual: manual,
          itm_last_checked_at: now,
        })
        .select('itm_id')
        .single()
      if (error) return { error: 'No se pudo guardar el artículo.' }
      itemId = item.itm_id
    }

    const { error: historyError } = await supabase.from('price_history').insert({
      ph_itm_id: itemId,
      ph_price: data.price,
      ph_in_stock: data.inStock,
      ph_source: 'browser',
    })
    await reload()
    if (historyError) return { error: 'Se guardó el precio, pero no quedó en el histórico. Vuelve a pulsar el botón.' }
    return { updated: Boolean(existing), previousPrice: existing?.itm_price ?? null, manual }
  }, [checkBlocked, findExisting, reload])

  /** Refresca todos los artículos del usuario. La lógica vive en la Edge
   * Function `refresh` (server-side), que es la misma que usa el pase
   * automático de pg_cron — ver docs/DECISIONES.md 2026-09-06. */
  const refreshAll = useCallback(async () => {
    setRefreshing(true)
    await supabase.functions.invoke('refresh', { body: {} })
    await reload()
    setRefreshing(false)
  }, [reload])

  /** Edita título, notas, carpeta o precio (manual) de un artículo ya guardado.
   * Si se pasa un precio nuevo y el artículo es manual, añade una fila a
   * price_history con ph_source = 'manual' (docs/ARQUITECTURA.md). */
  const updateItem = useCallback(async (itemId, changes) => {
    const { price, ...fields } = changes
    const update = { ...fields }
    if (price !== undefined) update.itm_price = price
    if (Object.keys(update).length > 0) {
      const { error } = await supabase.from('items').update(update).eq('itm_id', itemId)
      if (error) return { error: 'No se pudo guardar el cambio.' }
    }
    if (price != null) {
      await supabase.from('price_history').insert({
        ph_itm_id: itemId,
        ph_price: price,
        ph_source: 'manual',
      })
    }
    await reload()
    return {}
  }, [reload])

  /** Borra un artículo (RLS ya limita a los del propio usuario; el borrado
   * en cascada se lleva price_history por delante, ver migración 001). */
  const deleteItem = useCallback(async (itemId) => {
    const { error } = await supabase.from('items').delete().eq('itm_id', itemId)
    if (error) return { error: 'No se pudo borrar el artículo.' }
    await reload()
    return {}
  }, [reload])

  return { items, loading, loadError, refreshing, addItem, addManualItem, saveFromBrowser, updateItem, deleteItem, refreshAll, reload }
}
