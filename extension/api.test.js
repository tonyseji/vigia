import { describe, it, expect } from 'vitest'
import { chromeItemsPath } from './api.js'

describe('chromeItemsPath', () => {
  it('lo propio de tiendas que bloquean y lo que el servidor no pudo leer', () => {
    const path = chromeItemsPath('u1')
    expect(path).toContain('itm_usr_id=eq.u1')
    expect(path).toContain('or=(itm_is_manual.eq.true,itm_price.is.null,itm_last_error.not.is.null)')
  })
})
