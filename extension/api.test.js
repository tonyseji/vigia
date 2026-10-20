import { describe, it, expect } from 'vitest'
import { CHROME_ITEMS_PATH, itemsForThisChrome } from './api.js'

describe('lo que lee el pase de este Chrome', () => {
  it('tiendas que bloquean y lo que el servidor no pudo leer, de todo lo que ve', () => {
    expect(CHROME_ITEMS_PATH).toContain('or=(itm_is_manual.eq.true,itm_price.is.null,itm_last_error.not.is.null)')
    // Sin filtrar por usuario: la RLS deja ver también lo de carpetas compartidas.
    expect(CHROME_ITEMS_PATH).not.toContain('itm_usr_id=eq.')
  })

  it('los propios siempre; los de otros salvo los leídos bien en las últimas 20 h', () => {
    const now = new Date('2026-10-21T12:00:00Z').getTime()
    const ok = { itm_price: 10, itm_last_error: null }
    const items = [
      { ...ok, itm_id: 'mio-reciente', itm_usr_id: 'yo', itm_last_checked_at: '2026-10-21T11:00:00Z' },
      { ...ok, itm_id: 'suyo-nunca', itm_usr_id: 'ella', itm_last_checked_at: null },
      { ...ok, itm_id: 'suyo-ayer', itm_usr_id: 'ella', itm_last_checked_at: '2026-10-20T10:00:00Z' },
      { ...ok, itm_id: 'suyo-reciente', itm_usr_id: 'ella', itm_last_checked_at: '2026-10-21T08:00:00Z' },
      // El pase del servidor pone la fecha aunque falle (el H&M de la sesión 44).
      {
        itm_id: 'suyo-fallo-reciente',
        itm_usr_id: 'ella',
        itm_price: null,
        itm_last_error: 'No se encontro el precio en la pagina',
        itm_last_checked_at: '2026-10-21T02:05:00Z',
      },
    ]
    expect(itemsForThisChrome(items, 'yo', now).map((i) => i.itm_id)).toEqual([
      'mio-reciente',
      'suyo-nunca',
      'suyo-ayer',
      'suyo-fallo-reciente',
    ])
  })
})
