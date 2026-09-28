import { describe, it, expect } from 'vitest'
import {
  buildShareUrl,
  readJoinToken,
  removeJoinParam,
  savePendingJoin,
  loadPendingJoin,
  clearPendingJoin,
  shareLabel,
  joinErrorMessage,
} from '../shareLink.js'

const TOKEN = '0123456789abcdef0123456789abcdef'

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

describe('buildShareUrl / readJoinToken', () => {
  it('ida y vuelta: el enlace construido se lee igual', () => {
    const url = buildShareUrl('https://vigia-list.vercel.app', TOKEN)
    expect(url).toBe(`https://vigia-list.vercel.app/?unirse=${TOKEN}`)
    expect(readJoinToken(new URL(url).search)).toBe(TOKEN)
  })
  it('ignora URLs sin token o con un token con forma rara', () => {
    expect(readJoinToken('')).toBeNull()
    expect(readJoinToken('?otra=1')).toBeNull()
    expect(readJoinToken('?unirse=<script>')).toBeNull()
    expect(readJoinToken('?unirse=abc')).toBeNull()
  })
})

describe('removeJoinParam', () => {
  it('quita el token y conserva el resto, incluido el hash del login', () => {
    expect(removeJoinParam(`https://x.app/?unirse=${TOKEN}&a=1#access_token=z`)).toBe('https://x.app/?a=1#access_token=z')
    expect(removeJoinParam(`https://x.app/?unirse=${TOKEN}`)).toBe('https://x.app/')
  })
})

describe('invitación pendiente de login', () => {
  it('se guarda hasta después de entrar', () => {
    const storage = memoryStorage()
    savePendingJoin(TOKEN, storage)
    expect(loadPendingJoin(storage)).toBe(TOKEN)
    clearPendingJoin(storage)
    expect(loadPendingJoin(storage)).toBeNull()
  })
  it('descarta lo que no tenga forma de token', () => {
    const storage = memoryStorage()
    storage.setItem('vigia.pendingJoinToken', 'basura')
    expect(loadPendingJoin(storage)).toBeNull()
  })
  it('no lanza si el almacenamiento falla (modo privado)', () => {
    expect(() => savePendingJoin(TOKEN, broken)).not.toThrow()
    expect(loadPendingJoin(broken)).toBeNull()
    expect(() => clearPendingJoin(broken)).not.toThrow()
  })
})

describe('shareLabel', () => {
  const now = new Date('2026-09-29T12:00:00Z')
  it('invitación aceptada: muestra el email y Activo', () => {
    const l = shareLabel({ shr_status: 'accepted', shr_invited_email: 'elena@x.com' }, now)
    expect(l).toEqual({ who: 'elena@x.com', status: 'Activo', usableLink: false })
  })
  it('invitación por email aún sin aceptar', () => {
    const l = shareLabel({ shr_status: 'pending', shr_invited_email: 'elena@x.com', shr_token: null }, now)
    expect(l).toEqual({ who: 'elena@x.com', status: 'Pendiente', usableLink: false })
  })
  it('enlace sin usar: dice hasta cuándo vale y se puede reenviar', () => {
    const l = shareLabel(
      { shr_status: 'pending', shr_invited_email: null, shr_token: TOKEN, shr_expires_at: '2026-10-06T12:00:00Z' },
      now,
    )
    expect(l.who).toBe('Enlace sin usar')
    expect(l.status).toMatch(/^Caduca el 6 oct/)
    expect(l.usableLink).toBe(true)
  })
  it('enlace caducado: ya no se puede reenviar', () => {
    const l = shareLabel(
      { shr_status: 'pending', shr_invited_email: null, shr_token: TOKEN, shr_expires_at: '2026-09-28T12:00:00Z' },
      now,
    )
    expect(l).toEqual({ who: 'Enlace sin usar', status: 'Caducado', usableLink: false })
  })
})

describe('joinErrorMessage', () => {
  it('traduce los errores del servidor a palabras llanas', () => {
    expect(joinErrorMessage('enlace_no_valido')).toMatch(/ya se ha usado o ha caducado/)
    expect(joinErrorMessage('carpeta_propia')).toMatch(/tu propia carpeta/)
    expect(joinErrorMessage('Failed to fetch')).toMatch(/No se pudo/)
  })
})
