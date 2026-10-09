// Service worker de la extensión: guarda la página que se está viendo (lo
// pide el popup) y hace el pase diario por lo que el servidor no puede leer:
// tiendas que bloquean y lo que se quedó sin precio (docs/TIENDAS.md). Todo lo que toca la sesión pasa por aquí.
import { extractProduct } from './extract.js'
import { getSession, listChromeItems, login, logout, recordPrice } from './api.js'

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
  // Sin conexión no se puede ni renovar la sesión: se reintenta en la
  // siguiente alarma.
  if (alarm.name === 'pase') runPassIfDue().catch(() => {})
})

// Un pase que falló entero (sin conexión, sesión caducada) no cuenta: se
// reintenta en la siguiente alarma. Entre pases, lo que se haya añadido sin
// precio (desde el móvil, una tienda que el servidor no lee) se lee una vez
// en la hora, sin esperar al pase del día siguiente.
async function runPassIfDue() {
  if (!(await getSession())) return
  const { lastPass } = await chrome.storage.local.get('lastPass')
  if (!lastPass || lastPass.error || Date.now() - lastPass.at >= PASS_EVERY_HOURS * 3600_000) {
    await runPass()
    return
  }
  await readNewWithoutPrice()
}

/** Navega la pestaña y espera a que cargue. El listener se pone antes de
 * navegar: una página en caché puede terminar antes de que se registre. */
function navigate(tabId, url) {
  const loaded = new Promise((resolve, reject) => {
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
  return chrome.tabs.update(tabId, { url }).then(() => loaded)
}

async function readTab(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: extractProduct })
  return result
}

let passRunning = null

/** Cada artículo sin precio se intenta una sola vez fuera del pase diario
 * (los ids intentados se guardan): si no sale, ya lo recoge el pase. */
async function readNewWithoutPrice() {
  if (passRunning) return
  const { triedNew = [] } = await chrome.storage.local.get('triedNew')
  const items = (await listChromeItems()).filter((item) => item.itm_price == null && !triedNew.includes(item.itm_id))
  if (items.length === 0) return
  await chrome.storage.local.set({ triedNew: [...triedNew, ...items.map((item) => item.itm_id)].slice(-200) })
  // Cuenta como pase en marcha: así el popup no lanza otro a la vez.
  passRunning = readItems(items).finally(() => {
    passRunning = null
  })
  await passRunning
}

/** Abre cada artículo en una ventana minimizada, lee el precio y lo apunta.
 * Se manda la URL guardada, no la de la página: si la tienda redirige, se
 * actualiza el mismo artículo en vez de crear otro. */
async function readItems(items) {
  const result = { updated: 0, failed: [] }
  if (items.length === 0) return result
  const win = await chrome.windows.create({ url: 'about:blank', state: 'minimized' })
  try {
    const tabId = win.tabs[0].id
    for (const [i, item] of items.entries()) {
      if (i > 0) await sleep(4000 + Math.random() * 4000) // sin prisa: menos pinta de robot
      const name = item.itm_title && item.itm_title !== item.itm_url ? item.itm_title : item.itm_url
      try {
        await navigate(tabId, item.itm_url)
        await sleep(1500)
        let read = await readTab(tabId)
        // DataDome a veces enseña su pantalla un momento y deja pasar
        // solo: se le da una segunda oportunidad antes de darlo por perdido.
        if (read?.blocked) {
          await sleep(6000)
          read = await readTab(tabId)
        }
        if (read?.blocked) throw new Error('la tienda pidió verificación (captcha)')
        if (read?.price == null) throw new Error('no se encontró el precio')
        await recordPrice({ ...read, url: item.itm_url, itemId: item.itm_id })
        result.updated++
      } catch (err) {
        result.failed.push({ name, reason: err instanceof Error ? err.message : String(err) })
      }
    }
  } finally {
    await chrome.windows.remove(win.id).catch(() => {})
  }
  return result
}

/** El pase completo: todo lo que el servidor no puede leer. */
function runPass() {
  passRunning ??= (async () => {
    const summary = { at: Date.now(), updated: 0, failed: [], error: null }
    try {
      const { updated, failed } = await readItems(await listChromeItems())
      summary.updated = updated
      summary.failed = failed
    } catch (err) {
      summary.error = err instanceof Error ? err.message : String(err)
    } finally {
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
        runPassIfDue().catch(() => {})
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
  // Si algo falla (sin conexión), el popup recibe el motivo en vez de
  // quedarse sin respuesta.
  handler()
    .catch((err) => ({ error: err instanceof Error ? err.message : String(err) }))
    .then(sendResponse)
  return true
})
