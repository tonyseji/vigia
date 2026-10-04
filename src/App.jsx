import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from './hooks/useAuth.js'
import { useItems } from './hooks/useItems.js'
import { useFolders } from './hooks/useFolders.js'
import { useFolderShares } from './hooks/useFolderShares.js'
import { useSettings } from './hooks/useSettings.js'
import { useBasket } from './hooks/useBasket.js'
import Login from './components/Login.jsx'
import PasswordFields from './components/PasswordFields.jsx'
import AddItemForm from './components/AddItemForm.jsx'
import ItemList from './components/ItemList.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import FolderSidebar from './components/FolderSidebar.jsx'
import ShareFolderModal from './components/ShareFolderModal.jsx'
import InstallBanner from './components/InstallBanner.jsx'
import PendingInvitesBanner from './components/PendingInvitesBanner.jsx'
import BrowserImportBanner from './components/BrowserImportBanner.jsx'
import SharedLinkBanner from './components/SharedLinkBanner.jsx'
import { BasketBar, BasketSheet } from './components/Basket.jsx'
import { IconEngranaje, IconMenu, IconActualizar, IconCesta } from './components/icons/index.jsx'
import { loadErrorMessage } from './lib/loadErrors.js'
import { basketLines, basketSummary } from './lib/basket.js'
import { readJoinToken, removeJoinParam, savePendingJoin, loadPendingJoin, clearPendingJoin } from './lib/shareLink.js'
import { readImport, removeImportHash, savePendingImport, loadPendingImport, clearPendingImport, isTrustedImport } from './lib/browserImport.js'
import { readSharedUrl, savePendingShare, loadPendingShare, clearPendingShare } from './lib/shareTarget.js'

/** Si se abre la app con un enlace de invitación (?unirse=...), guarda el
 * token para usarlo en cuanto haya sesión y lo quita de la barra de
 * direcciones. Devuelve si hay una invitación esperando. */
function captureJoinToken() {
  const token = readJoinToken(window.location.search)
  if (token) {
    savePendingJoin(token)
    window.history.replaceState(null, '', removeJoinParam(window.location.href))
  }
  return loadPendingJoin() != null
}

/** Lo mismo para el botón del navegador (#importar=...): se guarda hasta
 * que haya sesión y se quita de la barra de direcciones. */
function captureImport() {
  const data = readImport(window.location.hash)
  if (data) {
    savePendingImport(data)
    window.history.replaceState(null, '', removeImportHash(window.location.href))
  }
}

/** Y para el menú Compartir de Android (/compartir?url=..., ver
 * src/lib/shareTarget.js): la dirección espera a la sesión y la barra vuelve
 * a la raíz. */
function captureShare() {
  const { pathname, search } = window.location
  if (!pathname.startsWith('/compartir')) return
  const url = readSharedUrl(pathname, search)
  if (url) savePendingShare(url)
  window.history.replaceState(null, '', '/')
}

export default function App() {
  const auth = useAuth()
  const [joining] = useState(() => {
    captureImport()
    captureShare()
    return captureJoinToken()
  })

  if (auth.loading) return null

  if (!auth.session) return <Login auth={auth} joining={joining} />

  if (auth.recovering) return <RecoveryScreen onSave={auth.updatePassword} onSkip={auth.finishRecovery} />

  return <Dashboard onSignOut={auth.signOut} email={auth.session.user.email} onChangePassword={auth.updatePassword} />
}

/** Tras abrir el correo de "recuperar contraseña" ya hay sesión, pero antes
 * de entrar en la app se elige la contraseña nueva. */
function RecoveryScreen({ onSave, onSkip }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-5 py-10">
      <h1 className="font-display text-3xl font-bold tracking-tight">Elige tu contraseña</h1>
      <p className="text-sm text-ink-mut">
        Con ella podrás entrar desde cualquier dispositivo, también desde la app instalada en el iPhone.
      </p>
      <PasswordFields onSave={onSave} />
      <button type="button" onClick={onSkip} className="self-start text-sm text-accent underline">
        Ahora no, ir a mi lista
      </button>
    </main>
  )
}

function Dashboard({ onSignOut, email, onChangePassword }) {
  const {
    items,
    loading,
    loadError: itemsLoadError,
    refreshing,
    addItem,
    addManualItem,
    saveFromBrowser,
    updateItem,
    deleteItem,
    refreshAll,
    reload: reloadItems,
  } = useItems()
  const {
    folders,
    foldersTree,
    loadError: foldersLoadError,
    createFolder,
    renameFolder,
    deleteFolder,
    reload: reloadFolders,
  } = useFolders()
  const folderShares = useFolderShares()
  const { settings, loadError: settingsLoadError, reload: reloadSettings, save: saveSettings } = useSettings()
  const itemsById = useMemo(() => Object.fromEntries(items.map((i) => [i.itm_id, i])), [items])
  const cesta = useBasket(itemsById, !loading && !itemsLoadError)
  const [showBasket, setShowBasket] = useState(false)
  const basketLinesList = useMemo(() => basketLines(cesta.basket, itemsById), [cesta.basket, itemsById])
  const basketTotals = useMemo(() => basketSummary(basketLinesList), [basketLinesList])
  const showBasketBar = cesta.picking || basketTotals.units > 0
  const [showSettings, setShowSettings] = useState(false)
  const [showSidebarMobile, setShowSidebarMobile] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState(null)
  // Lo último guardado desde el campo de añadir: ItemList lo enseña y lo
  // ilumina. Objeto nuevo en cada guardado, aunque sea el mismo id.
  const [justAdded, setJustAdded] = useState(null)
  const [sharingFolder, setSharingFolder] = useState(null)
  const [joinResult, setJoinResult] = useState(null) // { ok, text }
  const { acceptShareLink, acceptShare } = folderShares
  // Lo que mandó el botón del navegador. Se lee una vez y se borra del
  // almacenamiento: recargar la pestaña no lo vuelve a ofrecer.
  const [browserImport, setBrowserImport] = useState(loadPendingImport)
  // Lo mismo con lo compartido desde Android: se guarda una vez.
  const [sharedUrl, setSharedUrl] = useState(loadPendingShare)
  useEffect(() => {
    clearPendingImport()
    clearPendingShare()
  }, [])

  const markAdded = (result) => {
    if (result?.item) setJustAdded({ id: result.item.itm_id })
    return result
  }
  // Se olvida al acabar el destello (2,4 s en tailwind.css): si no, la fila
  // volvería a iluminarse cada vez que se montase (Lista → Fotos, plegar).
  useEffect(() => {
    if (!justAdded) return
    const timer = setTimeout(() => setJustAdded(null), 3000)
    return () => clearTimeout(timer)
  }, [justAdded])
  const handleAdd = async (url, folderId) => markAdded(await addItem(url, folderId))
  const handleAddManual = async (url, price, folderId) => markAdded(await addManualItem(url, price, folderId))
  const selectedFolder = folders.find((f) => f.fld_id === selectedFolderId)

  /** Guarda lo compartido: con precio si la tienda deja leerlo; si bloquea,
   * sin precio y en modo manual (la extensión de Chrome se lo pondrá). */
  const saveShared = useCallback(
    async (url) => {
      const result = await addItem(url, selectedFolderId)
      if (!result.blocked) return result
      const manual = await addManualItem(url, null, selectedFolderId)
      return manual.error ? manual : { item: manual.item, manual: true }
    },
    [addItem, addManualItem, selectedFolderId],
  )

  // Enlace de invitación pendiente (abierto antes o durante el login): se
  // usa una sola vez al entrar. Se borra antes de la llamada para que el
  // doble efecto de StrictMode no lo intente dos veces.
  useEffect(() => {
    const token = loadPendingJoin()
    if (!token) return
    clearPendingJoin()
    acceptShareLink(token).then(async (result) => {
      if (result.error) {
        setJoinResult({ ok: false, text: result.error })
        return
      }
      await Promise.all([reloadFolders(), reloadItems()])
      setSelectedFolderId(result.folderId)
      setJoinResult({ ok: true, text: `Te has unido a la carpeta «${result.folderName}».` })
    })
  }, [acceptShareLink, reloadFolders, reloadItems])

  // Aceptar una invitación cambia qué carpetas y artículos se ven: sin
  // recargarlos, la carpeta no aparecía hasta recargar la página.
  async function handleAcceptInvite(shareId) {
    const result = await acceptShare(shareId)
    if (!result.error) await Promise.all([reloadFolders(), reloadItems()])
    return result
  }

  const loadErrorText = loadErrorMessage({
    items: itemsLoadError,
    folders: foldersLoadError,
    shares: folderShares.loadError,
    settings: settingsLoadError,
  })
  const [retrying, setRetrying] = useState(false)

  async function retryLoad() {
    setRetrying(true)
    await Promise.all([
      itemsLoadError && reloadItems(),
      foldersLoadError && reloadFolders(),
      folderShares.loadError && folderShares.reload(),
      settingsLoadError && reloadSettings(),
    ])
    setRetrying(false)
  }

  const countByFolder = useMemo(() => {
    const counts = {}
    for (const item of items) {
      if (item.itm_fld_id) counts[item.itm_fld_id] = (counts[item.itm_fld_id] ?? 0) + 1
    }
    return counts
  }, [items])

  // La carpeta seleccionada filtra a ella y, si es de primer nivel, también
  // a sus subcarpetas (ver una carpeta padre incluye lo que hay dentro).
  const visibleItems = useMemo(() => {
    if (selectedFolderId == null) return items
    const childIds = foldersTree.find((f) => f.fld_id === selectedFolderId)?.children.map((c) => c.fld_id) ?? []
    const ids = new Set([selectedFolderId, ...childIds])
    return items.filter((item) => ids.has(item.itm_fld_id))
  }, [items, selectedFolderId, foldersTree])

  /** «Añadir a la cesta» del menú de carpeta: la carpeta y, si es de primer
   * nivel, sus subcarpetas (lo mismo que se ve al seleccionarla). */
  function addFolderToBasket(folder) {
    const ids = new Set([folder.fld_id, ...(folder.children ?? []).map((c) => c.fld_id)])
    cesta.addMany(items.filter((item) => ids.has(item.itm_fld_id)).map((item) => item.itm_id))
    setShowSidebarMobile(false)
  }

  return (
    // Con la barra de la cesta, hueco abajo para que no tape el último artículo.
    <main className={`mx-auto max-w-5xl px-5 pt-10 ${showBasketBar ? 'pb-32' : 'pb-10'}`}>
      <InstallBanner />

      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSidebarMobile(true)}
            aria-label="Carpetas"
            className="rounded-lg border border-line p-1.5 outline-none focus-visible:outline-2 focus-visible:outline-accent md:hidden"
          >
            <IconMenu className="h-4 w-4" />
          </button>
          <h1 className="font-display text-2xl font-bold tracking-tight">Vigía</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-ink-mut sm:gap-3">
          <button
            type="button"
            onClick={refreshAll}
            disabled={refreshing || items.length === 0}
            aria-label={refreshing ? 'Leyendo…' : 'Actualizar precios'}
            title="Actualizar precios"
            className="rounded-lg bg-accent p-1.5 font-semibold text-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60 sm:px-3 sm:py-1.5"
          >
            <IconActualizar className={`h-4 w-4 sm:hidden ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{refreshing ? 'Leyendo…' : '↻ Actualizar'}</span>
          </button>
          <button
            type="button"
            aria-pressed={cesta.picking}
            onClick={() => cesta.setPicking(!cesta.picking)}
            aria-label={`Cesta (${basketTotals.units})`}
            title="Cesta: marca artículos y mira cuánto costaría todo"
            className="flex items-center gap-1.5 rounded-lg border border-line p-1.5 outline-none focus-visible:outline-2 focus-visible:outline-accent aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-ink sm:px-3 sm:py-1.5"
          >
            <IconCesta className="h-4 w-4" />
            <span className="hidden sm:inline">Cesta</span>
            {basketTotals.units > 0 && (
              <span className="rounded-full bg-accent px-1.5 font-mono text-[11px] leading-[18px] text-surface">
                {basketTotals.units}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            aria-label="Ajustes"
            title="Ajustes"
            className="rounded-lg border border-line p-1.5 outline-none focus-visible:outline-2 focus-visible:outline-accent"
          >
            <IconEngranaje className="h-4 w-4" />
          </button>
          <span className="hidden sm:inline">{email}</span>
          <button
            type="button"
            onClick={onSignOut}
            className="hidden rounded-lg border border-line px-3 py-1.5 outline-none focus-visible:outline-2 focus-visible:outline-accent sm:block"
          >
            Salir
          </button>
        </div>
      </header>

      <div className="mt-6">
        {loadErrorText && (
          <div
            role="alert"
            className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-bad bg-bad-soft px-3 py-2 text-sm text-bad"
          >
            <span>{loadErrorText} Lo que ves puede estar incompleto.</span>
            <button
              type="button"
              onClick={retryLoad}
              disabled={retrying}
              className="flex-none rounded-lg border border-bad px-3 py-1 font-semibold outline-none focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
            >
              {retrying ? 'Reintentando…' : 'Reintentar'}
            </button>
          </div>
        )}
        {joinResult && (
          <div
            role="status"
            className={`mb-2 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
              joinResult.ok ? 'border-accent bg-accent-soft' : 'border-line bg-surface text-bad'
            }`}
          >
            <span>{joinResult.text}</span>
            <button
              type="button"
              onClick={() => setJoinResult(null)}
              aria-label="Cerrar aviso"
              className="flex-none rounded px-1.5 text-ink-mut outline-none focus-visible:outline-2 focus-visible:outline-accent"
            >
              ×
            </button>
          </div>
        )}
        {sharedUrl && (
          <SharedLinkBanner url={sharedUrl} onSave={saveShared} onUndo={deleteItem} onClose={() => setSharedUrl(null)} />
        )}
        {browserImport && (
          <BrowserImportBanner
            data={browserImport}
            autoSave={isTrustedImport(browserImport)}
            onSave={(data) => saveFromBrowser(data, selectedFolderId)}
            onClose={() => setBrowserImport(null)}
          />
        )}
        <PendingInvitesBanner
          invites={folderShares.pendingForMe}
          onAccept={handleAcceptInvite}
          onReject={folderShares.rejectShare}
        />
      </div>

      <div className="mt-6">
        <AddItemForm onAdd={handleAdd} onAddManual={handleAddManual} folderId={selectedFolderId} />
      </div>

      <div className="mt-6 flex items-start gap-6">
        <div className="hidden md:block">
          <FolderSidebar
            foldersTree={foldersTree}
            countByFolder={countByFolder}
            totalCount={items.length}
            selectedId={selectedFolderId}
            onSelect={setSelectedFolderId}
            createFolder={createFolder}
            renameFolder={renameFolder}
            deleteFolder={deleteFolder}
            folderShares={folderShares}
            onShare={setSharingFolder}
            onAddToBasket={addFolderToBasket}
          />
        </div>

        <div className="min-w-0 flex-1">
          <ItemList
            items={visibleItems}
            folders={folders}
            loading={loading}
            loadFailed={itemsLoadError}
            onUpdate={updateItem}
            onDelete={deleteItem}
            groupByFolder={selectedFolderId == null}
            folderName={selectedFolder?.fld_name ?? null}
            onShowAll={selectedFolderId != null ? () => setSelectedFolderId(null) : undefined}
            justAdded={justAdded}
            picking={cesta.picking}
            basket={cesta.basket}
            onToggleBasket={cesta.toggle}
          />
        </div>
      </div>

      {showBasketBar && (
        <BasketBar
          summary={basketTotals}
          picking={cesta.picking}
          onTogglePicking={() => cesta.setPicking(!cesta.picking)}
          onOpen={() => setShowBasket(true)}
        />
      )}

      {showBasket && (
        <BasketSheet
          lines={basketLinesList}
          summary={basketTotals}
          onSetQty={cesta.setQty}
          onStep={cesta.step}
          onClear={cesta.clear}
          onAddMore={() => {
            setShowBasket(false)
            cesta.setPicking(true)
          }}
          onClose={() => setShowBasket(false)}
        />
      )}

      {showSidebarMobile && (
        <div className="fixed inset-0 z-30 flex md:hidden" onClick={() => setShowSidebarMobile(false)}>
          <div className="absolute inset-0 bg-black/45" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex h-full w-72 max-w-[85vw] flex-col gap-3 overflow-y-auto border-r border-line bg-surface p-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Carpetas</h2>
              <button
                type="button"
                onClick={() => setShowSidebarMobile(false)}
                className="rounded-lg border border-line px-2 py-1 text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent"
              >
                Cerrar
              </button>
            </div>
            <FolderSidebar
              foldersTree={foldersTree}
              countByFolder={countByFolder}
              totalCount={items.length}
              selectedId={selectedFolderId}
              onSelect={(id) => {
                setSelectedFolderId(id)
                setShowSidebarMobile(false)
              }}
              createFolder={createFolder}
              renameFolder={renameFolder}
              deleteFolder={deleteFolder}
              folderShares={folderShares}
              onShare={setSharingFolder}
              onAddToBasket={addFolderToBasket}
            />
            <div className="mt-auto flex flex-col gap-2 border-t border-line pt-3">
              <span className="truncate text-xs text-ink-mut">{email}</span>
              <button
                type="button"
                onClick={onSignOut}
                className="rounded-lg border border-line px-3 py-1.5 text-left text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && settings && (
        <SettingsModal
          settings={settings}
          onSave={saveSettings}
          onChangePassword={onChangePassword}
          onClose={() => setShowSettings(false)}
        />
      )}

      {sharingFolder && (
        <ShareFolderModal
          folder={sharingFolder}
          shares={folderShares.sharesByFolder(sharingFolder.fld_id)}
          onCreateLink={folderShares.createShareLink}
          onRevoke={folderShares.revokeShare}
          onClose={() => setSharingFolder(null)}
        />
      )}
    </main>
  )
}
