import { useEffect, useRef, useState } from 'react'
import { IconCarpeta, IconChevronRight, IconMasOpciones, IconTodos } from './icons/index.jsx'

/** Navegación por carpetas: árbol de dos niveles, clic en una carpeta filtra
 * la lista de artículos. Las acciones (renombrar, subcarpeta, compartir,
 * borrar) viven en un menú «⋮», no como botones de texto siempre visibles
 * (docs/DECISIONES.md 2026-09-06, "El sidebar de carpetas sustituye al modal
 * de gestión"). En desktop ese botón solo aparece al pasar el ratón; por
 * debajo de md es siempre visible porque no hay hover en pantallas táctiles. */
export default function FolderSidebar({
  foldersTree,
  countByFolder,
  totalCount,
  selectedId,
  onSelect,
  createFolder,
  renameFolder,
  deleteFolder,
  folderShares,
  onShare,
}) {
  const [expanded, setExpanded] = useState(() => new Set(foldersTree.map((f) => f.fld_id)))
  const [creatingSubOf, setCreatingSubOf] = useState(null)
  const [creatingRoot, setCreatingRoot] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState(null)
  const [renamingName, setRenamingName] = useState('')
  const [openMenuId, setOpenMenuId] = useState(null)
  const menuRef = useRef(null)

  useEffect(() => {
    if (openMenuId == null) return
    // capture, pero solo cierra si el click fue fuera del menú abierto: si
    // no, un click dentro (Renombrar, Compartir…) nunca llega a su botón
    // porque el menú se desmonta antes de que React dispare ese onClick.
    const closeOnOutsideClick = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return
      setOpenMenuId(null)
    }
    document.addEventListener('click', closeOnOutsideClick, true)
    return () => document.removeEventListener('click', closeOnOutsideClick, true)
  }, [openMenuId])

  function toggle(folderId) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(folderId) ? next.delete(folderId) : next.add(folderId)
      return next
    })
  }

  async function submitNewRoot() {
    if (!newName.trim()) return
    await createFolder(newName)
    setNewName('')
    setCreatingRoot(false)
  }

  async function submitNewSub(parentId) {
    if (!newName.trim()) return
    await createFolder(newName, parentId)
    setNewName('')
    setCreatingSubOf(null)
    setExpanded((prev) => new Set(prev).add(parentId))
  }

  async function submitRename(folderId) {
    if (!renamingName.trim()) return
    await renameFolder(folderId, renamingName)
    setRenamingId(null)
  }

  async function handleDelete(folder) {
    if (!confirm(`¿Borrar la carpeta «${folder.fld_name}»? Los artículos pasarán a "Sin carpeta".`)) return
    if (selectedId === folder.fld_id || folder.children?.some((c) => c.fld_id === selectedId)) onSelect(null)
    await deleteFolder(folder.fld_id)
  }

  return (
    <nav className="flex w-full flex-col gap-0.5 md:w-56 md:flex-none" aria-label="Carpetas">
      <FolderRow
        icon={<IconTodos className="h-4 w-4" />}
        label="Todos los artículos"
        count={totalCount}
        active={selectedId == null}
        onClick={() => onSelect(null)}
      />

      {foldersTree.map((folder) => (
        <div key={folder.fld_id}>
          <FolderRow
            folder={folder}
            hasChildren={folder.children.length > 0}
            expanded={expanded.has(folder.fld_id)}
            onToggle={() => toggle(folder.fld_id)}
            label={folder.fld_name}
            count={
              (countByFolder[folder.fld_id] ?? 0) +
              folder.children.reduce((sum, c) => sum + (countByFolder[c.fld_id] ?? 0), 0)
            }
            active={selectedId === folder.fld_id}
            onClick={() => onSelect(folder.fld_id)}
            sharedBadge={!folder.isOwner}
            menuOpen={openMenuId === folder.fld_id}
            onMenuToggle={() => setOpenMenuId(openMenuId === folder.fld_id ? null : folder.fld_id)}
            menuRef={menuRef}
            renaming={renamingId === folder.fld_id}
            renamingName={renamingName}
            onRenamingNameChange={setRenamingName}
            onRenameSubmit={() => submitRename(folder.fld_id)}
            menu={
              folder.isOwner && (
                <FolderMenu
                  onRename={() => {
                    setRenamingId(folder.fld_id)
                    setRenamingName(folder.fld_name)
                    setOpenMenuId(null)
                  }}
                  onNewSubfolder={() => {
                    setCreatingSubOf(folder.fld_id)
                    setExpanded((prev) => new Set(prev).add(folder.fld_id))
                    setOpenMenuId(null)
                  }}
                  onShare={() => {
                    onShare(folder)
                    setOpenMenuId(null)
                  }}
                  onDelete={() => {
                    handleDelete(folder)
                    setOpenMenuId(null)
                  }}
                />
              )
            }
          />

          {expanded.has(folder.fld_id) && (
            <div className="flex flex-col gap-0.5">
              {folder.children.map((child) => (
                <FolderRow
                  key={child.fld_id}
                  indent
                  label={child.fld_name}
                  count={countByFolder[child.fld_id] ?? 0}
                  active={selectedId === child.fld_id}
                  onClick={() => onSelect(child.fld_id)}
                  menuOpen={openMenuId === child.fld_id}
                  onMenuToggle={() => setOpenMenuId(openMenuId === child.fld_id ? null : child.fld_id)}
                  menuRef={menuRef}
                  renaming={renamingId === child.fld_id}
                  renamingName={renamingName}
                  onRenamingNameChange={setRenamingName}
                  onRenameSubmit={() => submitRename(child.fld_id)}
                  menu={
                    child.isOwner && (
                      <FolderMenu
                        onRename={() => {
                          setRenamingId(child.fld_id)
                          setRenamingName(child.fld_name)
                          setOpenMenuId(null)
                        }}
                        onDelete={() => {
                          handleDelete(child)
                          setOpenMenuId(null)
                        }}
                      />
                    )
                  }
                />
              ))}

              {creatingSubOf === folder.fld_id && (
                <div className="flex items-center gap-1 py-0.5 pl-9 pr-2">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitNewSub(folder.fld_id)
                      if (e.key === 'Escape') setCreatingSubOf(null)
                    }}
                    onBlur={() => {
                      if (newName.trim()) submitNewSub(folder.fld_id)
                      else setCreatingSubOf(null)
                    }}
                    placeholder="Nueva subcarpeta"
                    className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1 text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {creatingRoot ? (
        <div className="flex items-center gap-1 px-2 py-1">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNewRoot()
              if (e.key === 'Escape') setCreatingRoot(false)
            }}
            onBlur={() => {
              if (newName.trim()) submitNewRoot()
              else setCreatingRoot(false)
            }}
            placeholder="Nueva carpeta"
            className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1 text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreatingRoot(true)}
          className="mt-1 rounded-md px-2 py-1.5 text-left text-sm text-ink-mut outline-none hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          + Nueva carpeta
        </button>
      )}
    </nav>
  )
}

function FolderRow({
  icon,
  folder,
  hasChildren,
  expanded,
  onToggle,
  indent,
  label,
  count,
  active,
  onClick,
  sharedBadge,
  menu,
  menuOpen,
  onMenuToggle,
  menuRef,
  renaming,
  renamingName,
  onRenamingNameChange,
  onRenameSubmit,
}) {
  if (renaming) {
    return (
      <div className="flex items-center gap-1 py-0.5 pr-1" style={{ paddingLeft: indent ? '2.25rem' : '0.5rem' }}>
        <input
          autoFocus
          value={renamingName}
          onChange={(e) => onRenamingNameChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onRenameSubmit()}
          onBlur={onRenameSubmit}
          className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1 text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent"
        />
      </div>
    )
  }

  return (
    <div
      className={`group flex items-center gap-1 rounded-md pr-1 ${active ? 'bg-accent-soft' : 'hover:bg-surface-2'}`}
      style={{ paddingLeft: indent ? '1.75rem' : '0.5rem' }}
    >
      {folder && (
        <button
          type="button"
          onClick={hasChildren ? onToggle : undefined}
          aria-label={hasChildren ? (expanded ? 'Contraer' : 'Expandir') : undefined}
          className={`flex h-5 w-5 flex-none items-center justify-center text-ink-mut outline-none focus-visible:outline-2 focus-visible:outline-accent ${hasChildren ? '' : 'invisible'}`}
        >
          <IconChevronRight className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
      )}

      <button
        type="button"
        onClick={onClick}
        className={`flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent ${active ? 'font-medium text-ink' : 'text-ink'}`}
      >
        {icon ?? <IconCarpeta className="h-3.5 w-3.5 flex-none text-ink-mut" />}
        <span className="truncate">{label}</span>
        {sharedBadge && <span className="flex-none text-xs text-ink-mut">· compartida</span>}
        <span className="ml-auto flex-none font-mono text-xs text-ink-mut">{count}</span>
      </button>

      {menu && (
        <div className="relative flex-none" ref={menuOpen ? menuRef : undefined}>
          <button
            type="button"
            onClick={onMenuToggle}
            aria-label="Más opciones"
            className={`flex h-6 w-6 items-center justify-center rounded text-ink-mut outline-none hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-accent ${menuOpen ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100'}`}
          >
            <IconMasOpciones className="h-4 w-4" />
          </button>
          {menuOpen && menu}
        </div>
      )}
    </div>
  )
}

function FolderMenu({ onRename, onNewSubfolder, onShare, onDelete }) {
  return (
    <div className="absolute right-0 top-7 z-10 flex w-44 flex-col gap-0.5 rounded-lg border border-line bg-surface p-1 shadow-lg">
      <button type="button" onClick={onRename} className="rounded-md px-2 py-1.5 text-left text-sm text-ink outline-none hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent">
        Renombrar
      </button>
      {onNewSubfolder && (
        <button type="button" onClick={onNewSubfolder} className="rounded-md px-2 py-1.5 text-left text-sm text-ink outline-none hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent">
          Nueva subcarpeta
        </button>
      )}
      {onShare && (
        <button type="button" onClick={onShare} className="rounded-md px-2 py-1.5 text-left text-sm text-ink outline-none hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent">
          Compartir
        </button>
      )}
      <button type="button" onClick={onDelete} className="rounded-md px-2 py-1.5 text-left text-sm text-bad outline-none hover:bg-bad-soft focus-visible:outline-2 focus-visible:outline-accent">
        Borrar
      </button>
    </div>
  )
}
