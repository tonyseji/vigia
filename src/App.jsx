import { useMemo, useState } from 'react'
import { useAuth } from './hooks/useAuth.js'
import { useItems } from './hooks/useItems.js'
import { useFolders } from './hooks/useFolders.js'
import { useFolderShares } from './hooks/useFolderShares.js'
import { useSettings } from './hooks/useSettings.js'
import { useComparison } from './hooks/useComparison.js'
import Login from './components/Login.jsx'
import AddItemForm from './components/AddItemForm.jsx'
import ItemList from './components/ItemList.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import FolderSidebar from './components/FolderSidebar.jsx'
import ShareFolderModal from './components/ShareFolderModal.jsx'
import InstallBanner from './components/InstallBanner.jsx'
import PendingInvitesBanner from './components/PendingInvitesBanner.jsx'
import { CompareBar, ComparisonSets } from './components/ComparisonPanel.jsx'
import { IconEngranaje, IconMenu } from './components/icons/index.jsx'

export default function App() {
  const { session, loading, signInWithEmail, signOut } = useAuth()

  if (loading) return null

  if (!session) return <Login onSignIn={signInWithEmail} />

  return <Dashboard onSignOut={signOut} email={session.user.email} />
}

function Dashboard({ onSignOut, email }) {
  const { items, loading, refreshing, addItem, addManualItem, updateItem, deleteItem, refreshAll } = useItems()
  const { folders, foldersTree, createFolder, renameFolder, deleteFolder } = useFolders()
  const folderShares = useFolderShares()
  const { settings, save: saveSettings } = useSettings()
  const comparison = useComparison()
  const [showSettings, setShowSettings] = useState(false)
  const [showSidebarMobile, setShowSidebarMobile] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState(null)
  const [sharingFolder, setSharingFolder] = useState(null)

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
        <div className="flex items-center gap-3 text-sm text-ink-mut">
          <button
            type="button"
            onClick={refreshAll}
            disabled={refreshing || items.length === 0}
            className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
          >
            {refreshing ? 'Leyendo…' : '↻ Actualizar'}
          </button>
          <button
            type="button"
            aria-pressed={comparison.active}
            onClick={() => (comparison.active ? comparison.stop() : comparison.start())}
            className="rounded-lg border border-line px-3 py-1.5 outline-none focus-visible:outline-2 focus-visible:outline-accent aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-ink"
          >
            Comparar
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
            className="rounded-lg border border-line px-3 py-1.5 outline-none focus-visible:outline-2 focus-visible:outline-accent"
          >
            Salir
          </button>
        </div>
      </header>

      <div className="mt-6">
        <PendingInvitesBanner
          invites={folderShares.pendingForMe}
          onAccept={folderShares.acceptShare}
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
          </div>
        </div>
      )}

      {showSettings && settings && (
        <SettingsModal settings={settings} onSave={saveSettings} onClose={() => setShowSettings(false)} />
      )}

      {sharingFolder && (
        <ShareFolderModal
          folder={sharingFolder}
          shares={folderShares.sharesByFolder(sharingFolder.fld_id)}
          onInvite={folderShares.invite}
          onRevoke={folderShares.revokeShare}
          onClose={() => setSharingFolder(null)}
        />
      )}
    </main>
  )
}
