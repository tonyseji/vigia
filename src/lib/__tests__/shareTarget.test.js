import { describe, it, expect } from 'vitest'
import { findUrlInText, readSharedUrl, readTypedUrl, savePendingShare, loadPendingShare, clearPendingShare } from '../shareTarget.js'

const MDM = 'https://www.maisonsdumonde.com/ES/es/p/mesita-jill-M21044867.htm'

describe('readSharedUrl', () => {
  it('coge el campo url', () => {
    expect(readSharedUrl('/compartir', `?title=Mesita&url=${encodeURIComponent(MDM)}`)).toBe(MDM)
  })

  it('saca la dirección de un texto con frase y puntuación', () => {
    const text = `Mira esta mesita en Maisons du Monde: ${MDM}.`
    expect(readSharedUrl('/compartir/', `?text=${encodeURIComponent(text)}`)).toBe(MDM)
  })

  it('ignora otras rutas, esquemas raros y textos sin dirección', () => {
    expect(readSharedUrl('/', `?url=${encodeURIComponent(MDM)}`)).toBeNull()
    expect(readSharedUrl('/compartir', '?url=javascript:alert(1)&text=hola')).toBeNull()
    expect(readSharedUrl('/compartir', '')).toBeNull()
  })
})

function memoryStorage() {
  const data = {}
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v)
    },
    removeItem: (k) => {
      delete data[k]
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
  removeItem: () => {
    throw new Error('bloqueado')
  },
}

describe('dirección compartida pendiente', () => {
  it('se guarda, se recupera y se borra', () => {
    const storage = memoryStorage()
    savePendingShare(MDM, storage)
    expect(loadPendingShare(storage)).toBe(MDM)
    clearPendingShare(storage)
    expect(loadPendingShare(storage)).toBeNull()
  })

  it('descarta lo que no sea una dirección web y no rompe sin almacenamiento', () => {
    const storage = memoryStorage()
    storage.setItem('vigia.pendingShare', 'javascript:alert(1)')
    expect(loadPendingShare(storage)).toBeNull()
    expect(() => savePendingShare(MDM, broken)).not.toThrow()
    expect(loadPendingShare(broken)).toBeNull()
    expect(() => clearPendingShare(broken)).not.toThrow()
  })
})

describe('readTypedUrl', () => {
  it('acepta la dirección tal cual', () => {
    expect(readTypedUrl(MDM)).toBe(MDM)
  })
  it('saca la dirección de una frase compartida', () => {
    expect(readTypedUrl(`Mira esto: ${MDM}`)).toBe(MDM)
  })
  it('añade https:// a una dirección escrita sin él', () => {
    expect(readTypedUrl('www.vinted.es/items/123-lampara')).toBe('https://www.vinted.es/items/123-lampara')
    expect(readTypedUrl('  ikea.com/es/es/p/mesa-123/ ')).toBe('https://ikea.com/es/es/p/mesa-123/')
  })
  it('rechaza lo que no es una dirección', () => {
    expect(readTypedUrl('mesa de comedor ikea')).toBe(null)
    expect(readTypedUrl('')).toBe(null)
    expect(readTypedUrl('hola.')).toBe(null)
  })
})

// Sesión 42: lo pegado o compartido empezaba por el enlace y seguía con texto
// («https://wallapop.com/item/mesa-123 ¡Mira esto!»). new URL() lo aceptaba
// entero (codifica los espacios y se come los saltos de línea), así que se
// pedía una dirección con la frase pegada y la tienda contestaba 404.
describe('findUrlInText con texto detrás del enlace', () => {
  const url = 'https://wallapop.com/item/juego-de-dos-mesitas-1309312092'
  it('espacio y frase detrás', () => {
    expect(findUrlInText(`${url} ¡Mira lo que he encontrado en Wallapop!`)).toBe(url)
  })
  it('salto de línea y frase detrás', () => {
    expect(findUrlInText(`${url}\nDescarga Wallapop`)).toBe(url)
    expect(findUrlInText(`${url}\r\n\r\nDescarga Wallapop`)).toBe(url)
  })
  it('frase delante y detrás', () => {
    expect(findUrlInText(`Mira esto: ${url} ¿te gusta?`)).toBe(url)
  })
  it('el enlace solo, con espacios alrededor, sigue igual', () => {
    expect(findUrlInText(`  ${url}?utm_medium=AppShare  `)).toBe(`${url}?utm_medium=AppShare`)
  })
  it('también al escribirlo o pegarlo en el campo', () => {
    expect(readTypedUrl(`${url} ¡Mira esto!`)).toBe(url)
  })
})
