/**
 * FileStructureView — VS Code-style file explorer
 *
 * How inline creation works (same as VS Code):
 *  1. Click toolbar icon / hover button / right-click "New File|Folder"
 *     → sets `pending = { parentDirId, kind }` and ensures the folder is OPEN
 *  2. An <InlineInput> row appears inside that folder at the correct indent
 *  3. Type a name → Enter commits, Escape cancels
 *  4. Clicking OUTSIDE the entire explorer cancels
 *     (we use a mousedown listener on document, not onBlur, so clicks on other
 *      parts of the tree don't accidentally cancel mid-type)
 */

import { useAppContext } from "@/context/AppContext"
import { useFileSystem } from "@/context/FileContext"
import { useViews } from "@/context/ViewContext"
import { useContextMenu } from "@/hooks/useContextMenu"
import useWindowDimensions from "@/hooks/useWindowDimensions"
import { ACTIVITY_STATE } from "@/types/app"
import { FileSystemItem, Id } from "@/types/file"
import { sortFileSystemItem } from "@/utils/file"
import { getIconClassName } from "@/utils/getIconClassName"
import { Icon } from "@iconify/react"
import cn from "classnames"
import {
    KeyboardEvent as ReactKeyboardEvent,
    MouseEvent,
    useEffect,
    useRef,
    useState,
} from "react"
import { AiOutlineFolder, AiOutlineFolderOpen } from "react-icons/ai"
import { MdDelete } from "react-icons/md"
import { PiPencilSimpleFill } from "react-icons/pi"
import {
    RiFileAddLine,
    RiFolderAddLine,
    RiFolderUploadLine,
} from "react-icons/ri"
import {
    LuSearch,
    LuLayoutTemplate,
    LuChevronRight,
    LuChevronDown,
} from "react-icons/lu"
import RenameView from "./RenameView"

// ── Types ─────────────────────────────────────────────────────────────────────

interface PendingCreation {
    parentDirId: Id
    kind: "file" | "directory"
}

interface FileStructureViewProps {
    onSearchOpen?: () => void
    onNewProject?: () => void
}

// ── Root ──────────────────────────────────────────────────────────────────────

function FileStructureView({ onSearchOpen, onNewProject }: FileStructureViewProps) {
    const {
        fileStructure,
        createFile,
        createDirectory,
        collapseDirectories,
    } = useFileSystem()

    const explorerRef = useRef<HTMLDivElement>(null)
    const [selectedDirId, setSelectedDirId] = useState<Id>(fileStructure.id)
    const [pending, setPending] = useState<PendingCreation | null>(null)

    // ------------------------------------------------------------------
    // Cancel pending creation when user clicks OUTSIDE the explorer.
    // We use document mousedown so we can check before the blur fires.
    // ------------------------------------------------------------------
    useEffect(() => {
        if (!pending) return
        const handler = (e: globalThis.MouseEvent) => {
            if (
                explorerRef.current &&
                !explorerRef.current.contains(e.target as Node)
            ) {
                setPending(null)
            }
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [pending])

    // ------------------------------------------------------------------
    // Ensure a directory is open (never close it when we need to add inside)
    // ------------------------------------------------------------------
    const ensureOpen = useFileSystem().toggleDirectory

    const openDir = (dirId: Id) => {
        // Only toggle if it is currently CLOSED
        const findNode = (node: FileSystemItem, id: Id): FileSystemItem | null => {
            if (node.id === id) return node
            for (const c of node.children ?? []) {
                const found = findNode(c, id)
                if (found) return found
            }
            return null
        }
        const node = findNode(fileStructure, dirId)
        if (node && !node.isOpen) ensureOpen(dirId)
    }

    // ------------------------------------------------------------------
    // Start inline creation
    // ------------------------------------------------------------------
    const startCreate = (kind: "file" | "directory", parentDirId: Id) => {
        openDir(parentDirId)
        setPending({ parentDirId, kind })
    }

    const commitCreate = (name: string) => {
        const trimmed = name.trim()
        if (!pending) return
        if (trimmed) {
            if (pending.kind === "file") createFile(pending.parentDirId, trimmed)
            else createDirectory(pending.parentDirId, trimmed)
        }
        setPending(null)
    }

    const cancelCreate = () => setPending(null)

    const sorted = sortFileSystemItem(fileStructure)

    return (
        <div className="flex min-h-0 flex-grow flex-col overflow-hidden">
            {/* ── Toolbar ── */}
            <div className="view-title flex items-center justify-between py-0.5">
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                    Explorer
                </span>
                <div className="flex items-center gap-0.5">
                    {onSearchOpen && (
                        <ToolBtn onClick={() => onSearchOpen()} title="Search">
                            <LuSearch size={14} />
                        </ToolBtn>
                    )}
                    {onNewProject && (
                        <ToolBtn onClick={() => onNewProject()} title="New project from template">
                            <LuLayoutTemplate size={14} />
                        </ToolBtn>
                    )}
                    <ToolBtn
                        onClick={() => startCreate("file", selectedDirId)}
                        title="New File"
                    >
                        <RiFileAddLine size={15} />
                    </ToolBtn>
                    <ToolBtn
                        onClick={() => startCreate("directory", selectedDirId)}
                        title="New Folder"
                    >
                        <RiFolderAddLine size={15} />
                    </ToolBtn>
                    <ToolBtn onClick={collapseDirectories} title="Collapse All">
                        <RiFolderUploadLine size={15} />
                    </ToolBtn>
                </div>
            </div>

            {/* ── Tree ── */}
            <div
                ref={explorerRef}
                className="relative min-h-0 flex-grow select-none overflow-y-auto overflow-x-hidden"
            >
                {/* Root-level inline creation (when selectedDirId is root) */}
                {pending && pending.parentDirId === fileStructure.id && (
                    <InlineInput
                        kind={pending.kind}
                        depth={0}
                        onCommit={commitCreate}
                        onCancel={cancelCreate}
                    />
                )}

                {sorted.children?.map((item) => (
                    <TreeNode
                        key={item.id}
                        item={item}
                        depth={0}
                        selectedDirId={selectedDirId}
                        setSelectedDirId={setSelectedDirId}
                        pending={pending}
                        onStartCreate={startCreate}
                        onCommitCreate={commitCreate}
                        onCancelCreate={cancelCreate}
                    />
                ))}
            </div>
        </div>
    )
}

// ── ToolBtn ───────────────────────────────────────────────────────────────────

function ToolBtn({
    onClick,
    title,
    children,
}: {
    onClick: () => void
    title: string
    children: React.ReactNode
}) {
    return (
        <button
            onMouseDown={(e) => e.preventDefault()} // prevent blur on InlineInput
            onClick={onClick}
            title={title}
            aria-label={title}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-darkHover hover:text-white"
        >
            {children}
        </button>
    )
}

// ── InlineInput ───────────────────────────────────────────────────────────────
// NO onBlur cancel — cancellation is handled by the document mousedown listener
// in the root so clicking anywhere inside the explorer keeps the input alive.

function InlineInput({
    kind,
    depth,
    onCommit,
    onCancel,
}: {
    kind: "file" | "directory"
    depth: number
    onCommit: (name: string) => void
    onCancel: () => void
}) {
    const [value, setValue] = useState("")
    const inputRef = useRef<HTMLInputElement>(null)

    // Auto-focus when the row appears
    useEffect(() => {
        // Small timeout so the DOM has settled after the parent folder opens
        const t = setTimeout(() => inputRef.current?.focus(), 30)
        return () => clearTimeout(t)
    }, [])

    const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault()
            e.stopPropagation()
            onCommit(value)
        } else if (e.key === "Escape") {
            e.preventDefault()
            e.stopPropagation()
            onCancel()
        }
    }

    const indentPx = 8 + depth * 12

    return (
        <div
            className="flex items-center gap-1 py-[2px]"
            style={{ paddingLeft: `${indentPx}px` }}
            onMouseDown={(e) => e.stopPropagation()} // don't let document handler cancel us
        >
            <IndentGuides depth={depth} />

            {/* Icon */}
            <span className="mr-1 flex-shrink-0">
                {kind === "directory" ? (
                    <AiOutlineFolder size={15} className="text-yellow-400/70" />
                ) : (
                    <Icon icon="vscode-icons:file-type-text" fontSize={15} />
                )}
            </span>

            {/* Text input */}
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={kind === "file" ? "filename.ext" : "folder name"}
                className="w-full rounded border border-primary bg-[#3c3c3c] px-1.5 py-[1px] text-xs text-white outline-none placeholder:text-gray-500"
            />
        </div>
    )
}

// ── TreeNode (dispatch to Dir or File) ────────────────────────────────────────

interface TreeNodeProps {
    item: FileSystemItem
    depth: number
    selectedDirId: Id
    setSelectedDirId: (id: Id) => void
    pending: PendingCreation | null
    onStartCreate: (kind: "file" | "directory", parentDirId: Id) => void
    onCommitCreate: (name: string) => void
    onCancelCreate: () => void
}

function TreeNode(props: TreeNodeProps) {
    if (props.item.type === "file") {
        return (
            <FileNode
                item={props.item}
                depth={props.depth}
                setSelectedDirId={props.setSelectedDirId}
            />
        )
    }
    return <DirNode {...props} />
}

// ── DirNode ───────────────────────────────────────────────────────────────────

function DirNode({
    item,
    depth,
    selectedDirId,
    setSelectedDirId,
    pending,
    onStartCreate,
    onCommitCreate,
    onCancelCreate,
}: TreeNodeProps) {
    const { toggleDirectory, deleteDirectory } = useFileSystem()
    const [isEditing, setEditing] = useState(false)
    const rowRef = useRef<HTMLDivElement>(null)
    const { coords, menuOpen, setMenuOpen } = useContextMenu({ ref: rowRef })

    const isSelected = selectedDirId === item.id

    const handleClick = (e: MouseEvent) => {
        e.stopPropagation()
        setSelectedDirId(item.id)
        toggleDirectory(item.id)
    }

    // keyboard shortcuts
    useEffect(() => {
        const node = rowRef.current
        if (!node) return
        node.tabIndex = 0
        const onKey = (e: globalThis.KeyboardEvent) => {
            if (e.key === "F2") { e.stopPropagation(); setEditing(true) }
            if (e.key === "Delete") {
                e.stopPropagation()
                if (confirm("Delete this folder and all its contents?")) {
                    deleteDirectory(item.id)
                }
            }
        }
        node.addEventListener("keydown", onKey)
        return () => node.removeEventListener("keydown", onKey)
    }, [item.id, deleteDirectory])

    const indentPx = 8 + depth * 12

    // Helper: start creation inside this folder (prevent blur cancel from
    // the document handler by using mousedown + stopPropagation)
    const handleStartCreate = (kind: "file" | "directory") => {
        setMenuOpen(false)
        // Open the folder first (openDir handles already-open case)
        if (!item.isOpen) toggleDirectory(item.id)
        onStartCreate(kind, item.id)
    }

    return (
        <div>
            {/* ── Row ── */}
            <div
                ref={rowRef}
                className={cn(
                    "group relative flex w-full cursor-pointer items-center rounded-sm py-[2px] pr-1 text-gray-300 transition-colors",
                    isSelected ? "bg-[#37373d]" : "hover:bg-[#2a2d2e]",
                )}
                style={{ paddingLeft: `${indentPx}px` }}
                onClick={handleClick}
            >
                <IndentGuides depth={depth} />

                {/* Chevron */}
                <span className="mr-0.5 flex-shrink-0 text-gray-500">
                    {item.isOpen ? (
                        <LuChevronDown size={12} />
                    ) : (
                        <LuChevronRight size={12} />
                    )}
                </span>

                {/* Folder icon */}
                <span className="mr-1.5 flex-shrink-0 text-yellow-400/80">
                    {item.isOpen ? (
                        <AiOutlineFolderOpen size={16} />
                    ) : (
                        <AiOutlineFolder size={16} />
                    )}
                </span>

                {/* Name / rename */}
                {isEditing ? (
                    <RenameView
                        id={item.id}
                        preName={item.name}
                        type="directory"
                        setEditing={setEditing}
                    />
                ) : (
                    <span
                        className="flex-grow truncate text-xs font-medium"
                        title={item.name}
                    >
                        {item.name}
                    </span>
                )}

                {/* Hover action buttons — always in DOM but invisible until hover */}
                {!isEditing && (
                    <span className="ml-auto hidden flex-shrink-0 items-center gap-0.5 group-hover:flex">
                        <HoverBtn
                            title="New File"
                            onMouseDown={(e) => {
                                e.stopPropagation() // prevent document cancel handler
                                e.preventDefault() // prevent blur
                            }}
                            onClick={(e) => {
                                e.stopPropagation()
                                handleStartCreate("file")
                            }}
                        >
                            <RiFileAddLine size={13} />
                        </HoverBtn>
                        <HoverBtn
                            title="New Folder"
                            onMouseDown={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                            }}
                            onClick={(e) => {
                                e.stopPropagation()
                                handleStartCreate("directory")
                            }}
                        >
                            <RiFolderAddLine size={13} />
                        </HoverBtn>
                    </span>
                )}
            </div>

            {/* ── Children + inline creation ── */}
            {item.isOpen && (
                <div>
                    {/* Inline creation row at the TOP of this folder's children */}
                    {pending && pending.parentDirId === item.id && (
                        <InlineInput
                            kind={pending.kind}
                            depth={depth + 1}
                            onCommit={onCommitCreate}
                            onCancel={onCancelCreate}
                        />
                    )}

                    {item.children?.map((child) => (
                        <TreeNode
                            key={child.id}
                            item={child}
                            depth={depth + 1}
                            selectedDirId={selectedDirId}
                            setSelectedDirId={setSelectedDirId}
                            pending={pending}
                            onStartCreate={onStartCreate}
                            onCommitCreate={onCommitCreate}
                            onCancelCreate={onCancelCreate}
                        />
                    ))}
                </div>
            )}

            {/* ── Context menu ── */}
            {menuOpen && (
                <ContextMenu
                    top={coords.y}
                    left={coords.x}
                    items={[
                        {
                            label: "New File",
                            icon: <RiFileAddLine size={14} />,
                            onClick: () => handleStartCreate("file"),
                        },
                        {
                            label: "New Folder",
                            icon: <RiFolderAddLine size={14} />,
                            onClick: () => handleStartCreate("directory"),
                        },
                        { separator: true },
                        {
                            label: "Rename",
                            icon: <PiPencilSimpleFill size={14} />,
                            onClick: () => {
                                setMenuOpen(false)
                                setEditing(true)
                            },
                        },
                        {
                            label: "Delete Folder",
                            icon: <MdDelete size={15} />,
                            danger: true,
                            onClick: () => {
                                setMenuOpen(false)
                                if (confirm("Delete this folder and all its contents?")) {
                                    deleteDirectory(item.id)
                                }
                            },
                        },
                    ]}
                />
            )}
        </div>
    )
}

// ── FileNode ──────────────────────────────────────────────────────────────────

function FileNode({
    item,
    depth,
    setSelectedDirId,
}: {
    item: FileSystemItem
    depth: number
    setSelectedDirId: (id: Id) => void
}) {
    const { deleteFile, openFile, activeFile } = useFileSystem()
    const { setIsSidebarOpen } = useViews()
    const { isMobile } = useWindowDimensions()
    const { activityState, setActivityState } = useAppContext()
    const [isEditing, setEditing] = useState(false)
    const fileRef = useRef<HTMLDivElement>(null)
    const { menuOpen, coords, setMenuOpen } = useContextMenu({ ref: fileRef })

    const isActive = activeFile?.id === item.id

    const handleClick = (e: MouseEvent) => {
        if (isEditing) return
        e.stopPropagation()
        setSelectedDirId(item.id)
        openFile(item.id)
        if (isMobile) setIsSidebarOpen(false)
        if (activityState === ACTIVITY_STATE.DRAWING) {
            setActivityState(ACTIVITY_STATE.CODING)
        }
    }

    useEffect(() => {
        const node = fileRef.current
        if (!node) return
        node.tabIndex = 0
        const onKey = (e: globalThis.KeyboardEvent) => {
            if (e.key === "F2") { e.stopPropagation(); setEditing(true) }
            if (e.key === "Delete") {
                e.stopPropagation()
                if (confirm("Delete this file?")) deleteFile(item.id)
            }
        }
        node.addEventListener("keydown", onKey)
        return () => node.removeEventListener("keydown", onKey)
    }, [item.id, deleteFile])

    const indentPx = 8 + depth * 12

    return (
        <div
            ref={fileRef}
            className={cn(
                "group relative flex w-full cursor-pointer items-center rounded-sm py-[2px] pr-2 transition-colors",
                isActive
                    ? "bg-[#37373d] text-white"
                    : "text-gray-400 hover:bg-[#2a2d2e] hover:text-gray-200",
            )}
            style={{ paddingLeft: `${indentPx}px` }}
            onClick={handleClick}
        >
            <IndentGuides depth={depth} />

            <Icon
                icon={getIconClassName(item.name)}
                fontSize={15}
                className="mr-1.5 flex-shrink-0"
            />

            {isEditing ? (
                <RenameView
                    id={item.id}
                    preName={item.name}
                    type="file"
                    setEditing={setEditing}
                />
            ) : (
                <>
                    <span
                        className="flex-grow truncate text-xs"
                        title={item.name}
                    >
                        {item.name}
                    </span>
                    {item.isDirty && (
                        <span
                            className="ml-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary"
                            title="Modified"
                        />
                    )}
                </>
            )}

            {menuOpen && (
                <ContextMenu
                    top={coords.y}
                    left={coords.x}
                    items={[
                        {
                            label: "Rename",
                            icon: <PiPencilSimpleFill size={14} />,
                            onClick: () => {
                                setMenuOpen(false)
                                setEditing(true)
                            },
                        },
                        {
                            label: "Delete File",
                            icon: <MdDelete size={15} />,
                            danger: true,
                            onClick: () => {
                                setMenuOpen(false)
                                if (confirm("Delete this file?")) deleteFile(item.id)
                            },
                        },
                    ]}
                />
            )}
        </div>
    )
}

// ── IndentGuides ──────────────────────────────────────────────────────────────

function IndentGuides({ depth }: { depth: number }) {
    if (depth === 0) return null
    return (
        <>
            {Array.from({ length: depth }).map((_, i) => (
                <span
                    key={i}
                    className="pointer-events-none absolute top-0 h-full w-px bg-gray-700/40"
                    style={{ left: `${8 + i * 12 + 8}px` }}
                />
            ))}
        </>
    )
}

// ── HoverBtn ──────────────────────────────────────────────────────────────────

function HoverBtn({
    title,
    onClick,
    onMouseDown,
    children,
}: {
    title: string
    onClick: (e: MouseEvent) => void
    onMouseDown?: (e: MouseEvent) => void
    children: React.ReactNode
}) {
    return (
        <button
            title={title}
            aria-label={title}
            onMouseDown={onMouseDown}
            onClick={onClick}
            className="rounded p-0.5 text-gray-400 hover:bg-[#3a3d3f] hover:text-white"
        >
            {children}
        </button>
    )
}

// ── ContextMenu ───────────────────────────────────────────────────────────────

interface MenuItem {
    label?: string
    icon?: React.ReactNode
    danger?: boolean
    separator?: true
    onClick?: () => void
}

function ContextMenu({
    top,
    left,
    items,
}: {
    top: number
    left: number
    items: MenuItem[]
}) {
    return (
        <div
            className="fixed z-50 min-w-[168px] overflow-hidden rounded-md border border-[#454545] bg-[#252526] py-1 shadow-2xl"
            style={{ top, left }}
            onMouseDown={(e) => e.stopPropagation()} // keep pending alive
            onClick={(e) => e.stopPropagation()}
        >
            {items.map((item, i) =>
                item.separator ? (
                    <div key={i} className="my-1 border-t border-[#3c3c3c]" />
                ) : (
                    <button
                        key={item.label}
                        onClick={item.onClick}
                        className={cn(
                            "flex w-full items-center gap-2.5 px-3 py-[5px] text-xs transition-colors hover:bg-[#094771]",
                            item.danger
                                ? "text-red-400 hover:text-red-300"
                                : "text-[#cccccc]",
                        )}
                    >
                        <span className="flex-shrink-0 opacity-80">
                            {item.icon}
                        </span>
                        {item.label}
                    </button>
                ),
            )}
        </div>
    )
}

export default FileStructureView
