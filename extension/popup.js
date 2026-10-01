// Ventana del icono. Al abrirla guarda la página que se está viendo (un clic,
// sin confirmar) y enseña cómo va el pase diario. Todo lo que toca la sesión
// lo hace background.js; aquí solo se pinta.
import { APP_URL } from './api.js'

const $ = (id) => document.getElementById(id)
const send = (message) => chrome.runtime.sendMessage(message)

const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })
const when = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function line(text, className = '') {
  const p = document.createElement('p')
  p.textContent = text
  if (className) p.className = className
  return p
}

async function init() {
  const status = await send({ type: 'status' })
  if (!status.user) {
    $('login').hidden = false
    $('email').focus()
    return
  }
  showApp(status)
  saveCurrentTab()
}

function showApp(status) {
  $('login').hidden = true
  $('app').hidden = false
  $('user').textContent = status.user.email
  renderPass(status.lastPass, status.running)
}

async function saveCurrentTab() {
  const box = $('save')
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.url?.startsWith('http') || tab.url.startsWith(APP_URL)) {
    box.replaceChildren(line('Abre la ficha de un producto y pulsa el icono para guardarlo.', 'mut'))
    return
  }
  const result = await send({ type: 'saveTab', tabId: tab.id })
  if (result.error) {
    box.replaceChildren(line(result.error, 'bad'))
    return
  }

  const text = document.createElement('div')
  text.append(line(result.title || 'Producto', 'title'), line(eur.format(result.price)))
  let message
  if (result.created) message = 'Guardado en tu lista.'
  else if (result.previousPrice != null && Number(result.previousPrice) !== result.price)
    message = `Precio actualizado: antes ${eur.format(result.previousPrice)}.`
  else message = 'Ya lo tenías: precio apuntado, sin cambios.'
  text.append(line(message, 'ok'))
  if (result.manual) text.append(line('Esta tienda no tiene precio automático en el servidor: se actualizará desde este Chrome.', 'mut'))

  const nodes = []
  const image = result.image
  if (typeof image === 'string' && image.startsWith('https://')) {
    const img = document.createElement('img')
    img.src = image
    img.alt = ''
    nodes.push(img)
  }
  box.replaceChildren(...nodes, text)
}

function renderPass(lastPass, running) {
  $('run-pass').disabled = running
  $('run-pass').textContent = running ? 'Actualizando…' : 'Actualizar ahora'
  const failed = $('pass-failed')
  failed.replaceChildren()
  if (running) {
    $('pass-status').textContent = 'Leyendo precios en una ventana minimizada…'
    return
  }
  if (!lastPass) {
    $('pass-status').textContent = 'Aún no se ha hecho ningún pase. Se hace solo una vez al día mientras Chrome esté abierto.'
    return
  }
  if (lastPass.error) {
    $('pass-status').textContent = `Último intento (${when.format(lastPass.at)}): ${lastPass.error}`
    $('pass-status').className = 'bad'
    return
  }
  const n = lastPass.updated
  $('pass-status').className = 'mut'
  $('pass-status').textContent = `Último pase: ${when.format(lastPass.at)} · ${n} artículo${n === 1 ? '' : 's'} actualizado${n === 1 ? '' : 's'}.`
  for (const f of lastPass.failed) {
    const li = document.createElement('li')
    li.textContent = `${f.name.slice(0, 50)}: ${f.reason}`
    failed.append(li)
  }
}

$('login').addEventListener('submit', async (e) => {
  e.preventDefault()
  const button = e.submitter
  button.disabled = true
  $('login-error').hidden = true
  const result = await send({ type: 'login', email: $('email').value.trim(), password: $('password').value })
  button.disabled = false
  if (result.error) {
    $('login-error').textContent = result.error
    $('login-error').hidden = false
    return
  }
  $('password').value = ''
  showApp(await send({ type: 'status' }))
  saveCurrentTab()
})

$('run-pass').addEventListener('click', async () => {
  renderPass(null, true)
  const { lastPass } = await send({ type: 'runPass' })
  renderPass(lastPass, false)
})

$('open-app').addEventListener('click', (e) => {
  e.preventDefault()
  chrome.tabs.create({ url: APP_URL })
})

$('logout').addEventListener('click', async () => {
  await send({ type: 'logout' })
  $('app').hidden = true
  $('login').hidden = false
})

init()
