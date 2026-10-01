import { useEffect, useMemo, useState } from 'react'
import { useAuth } from './hooks/useAuth.js'
import { useItems } from './hooks/useItems.js'
import { useFolders } from './hooks/useFolders.js'
import { useFolderShares } from './hooks/useFolderShares.js'
import { useSettings } from './hooks/useSettings.js'
import { useComparison } from './hooks/useComparison.js'
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
import { CompareBar, ComparisonSets } from './components/ComparisonPanel.jsx'
import { IconEngranaje, IconMenu, IconActualizar, IconComparar } from './components/icons/index.jsx'
import { loadErrorMessage } from './lib/loadErrors.js'
import { readJoinToken, removeJoinParam, savePendingJoin, loadPendingJoin, clearPendingJoin } from './lib/shareLink.js'
import { readImport, removeImportHash, savePendingImport, loadPendingImport, clearPendingImport, isTrustedImport } from './lib/browserImport.js'

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

export default function App() {
  const auth = useAuth()
  const [joining] = useState(() => {
    captureImport()
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
  const comparison = useComparison()
  const [showSettings, setShowSettings] = useState(false)
  const [showSidebarMobile, setShowSidebarMobile] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState(null)
  const [sharingFolder, setSharingFolder] = useState(null)
  const [joinResult, setJoinResult] = useState(null) // { ok, text }
  const { acceptShareLink, acceptShare } = folderShares
  // Lo que mandó el botón del navegador. Se lee una vez y se borra del
  // almacenamiento: recargar la pestaña no lo vuelve a ofrecer.
  const [browserImport, setBrowserImport] = useState(loadPendingImport)
  useEffect(() => {
    clearPendingImport()
  }, [])

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

  const itemsById = useMemo(() => Object.fromEntries(items.map((i) => [i.itm_id, i])), [items])

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

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
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
            aria-pressed={comparison.active}
            onClick={() => (comparison.active ? comparison.stop() : comparison.start())}
            aria-label="Comparar"
            title="Comparar"
            className="rounded-lg border border-line p-1.5 outline-none focus-visible:outline-2 focus-visible:outline-accent aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-ink sm:px-3 sm:py-1.5"
          >
            <IconComparar className="h-4 w-4 sm:hidden" />
            <span className="hidden sm:inline">Comparar</span>
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
        <AddItemForm onAdd={addItem} onAddManual={addManualItem} folderId={selectedFolderId} />
      </div>

      {comparison.active && comparison.sets.length > 0 && (
        <div className="mt-6">
          <ComparisonSets sets={comparison.sets} itemsById={itemsById} onRemove={comparison.removeSet} />
        </div>
      )}

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
            comparing={comparison.active}
            selectedIds={comparison.selectedIds}
            onToggleSelected={comparison.toggleSelected}
          />
        </div>
      </div>

      {comparison.active && (
        <div className="mt-4">
          <CompareBar
            selectedCount={comparison.selectedIds.size}
            onSave={comparison.saveSet}
            onCancel={comparison.stop}
          />
        </div>
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
