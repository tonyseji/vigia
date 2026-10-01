// Service worker de la extensión: guarda la página que se está viendo (lo
// pide el popup) y hace el pase diario por las tiendas que el servidor no
// puede leer (docs/TIENDAS.md). Todo lo que toca la sesión pasa por aquí.
import { extractProduct } from './extract.js'
import { getSession, listManualItems, login, logout, recordPrice } from './api.js'

const PASS_EVERY_HOURS = 20 // Como el pase diario del servidor (refresh/notify.ts, cronCutoffHours)
const LOAD_TIMEOUT_MS = 30_000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Una alarma cada hora: si el último pase tiene más de 20 h, toca otro. Así
// no importa a qué hora se encienda el ordenador o se abra Chrome.
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('pase', { delayInMinutes: 1, periodInMinutes: 60 })
})
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('pase', { delayInMinutes: 2, periodInMinutes: 60 })
})
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pase') runPassIfDue()
})

// Un pase que falló entero (sin conexión, sesión caducada) no cuenta: se
// reintenta en la siguiente alarma.
async function runPassIfDue() {
  const { lastPass } = await chrome.storage.local.get('lastPass')
  if (lastPass && !lastPass.error && Date.now() - lastPass.at < PASS_EVERY_HOURS * 3600_000) return
  if (!(await getSession())) return
  await runPass()
}

function waitForLoad(tabId) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener)
      reject(new Error('La página tardó demasiado en cargar'))
    }, LOAD_TIMEOUT_MS)
    function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timer)
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
    }
    chrome.tabs.onUpdated.addListener(listener)
  })
}

async function readTab(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: extractProduct })
  return result
}

let passRunning = null

/** Abre cada artículo en una ventana minimizada, lee el precio y lo apunta.
 * Se manda la URL guardada, no la de la página: si la tienda redirige, se
 * actualiza el mismo artículo en vez de crear otro. */
function runPass() {
  passRunning ??= (async () => {
    const summary = { at: Date.now(), updated: 0, failed: [], error: null }
    let windowId = null
    try {
      const items = await listManualItems()
      if (items.length > 0) {
        const win = await chrome.windows.create({ url: 'about:blank', state: 'minimized' })
        windowId = win.id
        const tabId = win.tabs[0].id
        for (const [i, item] of items.entries()) {
          if (i > 0) await sleep(4000 + Math.random() * 4000) // sin prisa: menos pinta de robot
          const name = item.itm_title && item.itm_title !== item.itm_url ? item.itm_title : item.itm_url
          try {
            await chrome.tabs.update(tabId, { url: item.itm_url })
            await waitForLoad(tabId)
            await sleep(1500)
            const read = await readTab(tabId)
            if (read?.blocked) throw new Error('la tienda pidió verificación (captcha)')
            if (read?.price == null) throw new Error('no se encontró el precio')
            await recordPrice({ ...read, url: item.itm_url })
            summary.updated++
          } catch (err) {
            summary.failed.push({ name, reason: err instanceof Error ? err.message : String(err) })
          }
        }
      }
    } catch (err) {
      summary.error = err instanceof Error ? err.message : String(err)
    } finally {
      if (windowId != null) await chrome.windows.remove(windowId).catch(() => {})
      await chrome.storage.local.set({ lastPass: summary })
      passRunning = null
    }
    return summary
  })()
  return passRunning
}

async function saveTab(tabId) {
  let read
  try {
    read = await readTab(tabId)
  } catch {
    return { error: 'Esta página no se puede leer (páginas internas de Chrome, PDFs…).' }
  }
  if (read?.blocked) return { error: 'La tienda está pidiendo verificación. Resuélvela en la página y vuelve a probar.' }
  if (read?.price == null) return { error: 'No encuentro el precio en esta página. Ábrela desde la ficha de un producto.' }
  try {
    const result = await recordPrice(read)
    return { ...result, title: read.title, image: read.image, price: read.price }
  } catch (err) {
    return { error: err.message }
  }
}

// Mensajes del popup. `return true` deja abierto el canal para responder
// cuando termine la promesa.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handlers = {
    status: async () => {
      const session = await getSession()
      const { lastPass } = await chrome.storage.local.get('lastPass')
      return { user: session?.user ?? null, lastPass: lastPass ?? null, running: passRunning != null }
    },
    login: async () => {
      try {
        const user = await login(message.email, message.password)
        runPassIfDue()
        return { user }
      } catch (err) {
        return { error: err.message }
      }
    },
    logout: async () => {
      await logout()
      return {}
    },
    saveTab: () => saveTab(message.tabId),
    runPass: async () => {
      await runPass()
      const { lastPass } = await chrome.storage.local.get('lastPass')
      return { lastPass }
    },
  }
  const handler = handlers[message?.type]
  if (!handler) return false
  handler().then(sendResponse)
  return true
})
