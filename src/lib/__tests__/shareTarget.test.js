import { describe, it, expect } from 'vitest'
import { readSharedUrl, savePendingShare, loadPendingShare, clearPendingShare } from '../shareTarget.js'

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
