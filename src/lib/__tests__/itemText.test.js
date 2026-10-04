import { describe, it, expect } from 'vitest'
import { titleFromUrl, displayTitle, normalizeSearch } from '../itemText.js'

describe('titleFromUrl', () => {
  it('saca el nombre de una ficha de Shein', () => {
    expect(titleFromUrl('https://es.shein.com/Lampara-de-mesa-LED-p-31864327.html')).toBe('Lampara de mesa LED')
  })
  it('quita el número final de Wallapop', () => {
    expect(titleFromUrl('https://es.wallapop.com/item/lampara-de-pie-hektar-gris-1309402404')).toBe(
      'Lampara de pie hektar gris',
    )
  })
  it('quita la referencia de Maisons du Monde', () => {
    expect(titleFromUrl('https://www.maisonsdumonde.com/ES/es/p/mesita-de-noche-jill-M21044867.htm')).toBe(
      'Mesita de noche jill',
    )
  })
  it('deshace los caracteres codificados', () => {
    expect(titleFromUrl('https://tienda.example/p/sof%C3%A1-cama-gris')).toBe('Sofá cama gris')
  })
  it('sin nombre en la dirección, se queda con la tienda', () => {
    expect(titleFromUrl('https://es.aliexpress.com/item/1005006123456789.html')).toBe('es.aliexpress.com')
    expect(titleFromUrl('https://a.aliexpress.com/_mKx3AbC')).toBe('a.aliexpress.com')
    expect(titleFromUrl('https://www.kavehome.com/')).toBe('kavehome.com')
  })
  it('no revienta con algo que no es una dirección', () => {
    expect(titleFromUrl('no es una url')).toBe('no es una url')
  })
})

describe('displayTitle', () => {
  const url = 'https://es.shein.com/Lampara-de-mesa-LED-p-31864327.html'
  it('usa el título guardado si lo hay', () => {
    expect(displayTitle({ itm_title: 'Lámpara LED', itm_url: url })).toBe('Lámpara LED')
  })
  it('si el título es la dirección (aún sin nombre), lo saca de ella', () => {
    expect(displayTitle({ itm_title: url, itm_url: url })).toBe('Lampara de mesa LED')
    expect(displayTitle({ itm_title: null, itm_url: url })).toBe('Lampara de mesa LED')
  })
})

describe('normalizeSearch', () => {
  it('ignora tildes y mayúsculas', () => {
    expect(normalizeSearch('Lámpara de PIE')).toBe('lampara de pie')
    expect(normalizeSearch('lampara de pie').includes(normalizeSearch('LÁMPARA'))).toBe(true)
  })
})
