import { useState, useRef } from "react"
import FileStructureView from "@/components/files/FileStructureView"
import FileSearchPanel from "@/components/files/FileSearchPanel"
import NewProjectModal from "@/components/files/NewProjectModal"
import { useFileSystem } from "@/context/FileContext"
import useResponsive from "@/hooks/useResponsive"
import { FileSystemItem } from "@/types/file"
import cn from "classnames"
import JSZip from "jszip"
import { BiArchiveIn } from "react-icons/bi"
import { TbFileUpload } from "react-icons/tb"
import { LuPackageOpen } from "react-icons/lu"
import { v4 as uuidV4 } from "uuid"
import { toast } from "react-hot-toast"

// ── helpers ───────────────────────────────────────────────────────────────────

const BLACKLIST = ["node_modules", ".git", ".vscode", ".next", "__pycache__"]
const MAX_FILE_BYTES = 1024 * 1024 // 1 MB

async function readFileContent(file: File): Promise<string> {
    if (file.size > MAX_FILE_BYTES) {
        return `// File too large to display: ${file.name} (${Math.round(file.size / 1024)} KB)`
    }
    try {
        return await file.text()
    } catch {
        return `// Error reading file: ${file.name}`
    }
}

async function readDirectoryHandle(
    handle: FileSystemDirectoryHandle,
): Promise<FileSystemItem[]> {
    const children: FileSystemItem[] = []
    for await (const entry of handle.values()) {
        if (entry.kind === "file") {
            const f = await entry.getFile()
            children.push({
                id: uuidV4(),
                name: entry.name,
                type: "file",
                content: await readFileContent(f),
            })
        } else if (entry.kind === "directory") {
            if (BLACKLIST.includes(entry.name)) continue
            children.push({
                id: uuidV4(),
                name: entry.name,
                type: "directory",
                children: await readDirectoryHandle(entry),
                isOpen: false,
            })
        }
    }
    return children
}

async function readFileList(files: FileList): Promise<FileSystemItem[]> {
    const children: FileSystemItem[] = []
    for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const parts = file.webkitRelativePath.split("/")
        if (parts.some((p) => BLACKLIST.includes(p))) continue

        if (parts.length > 1) {
            const dirPath = parts.slice(0, -1).join("/")
            let dir = children.find(
                (c) => c.name === dirPath && c.type === "directory",
            )
            if (!dir) {
                dir = {
                    id: uuidV4(),
                    name: dirPath,
                    type: "directory",
                    children: [],
                    isOpen: false,
                }
                children.push(dir)
            }
            dir.children!.push({
                id: uuidV4(),
                name: file.name,
                type: "file",
                content: await readFileContent(file),
            })
        } else {
            children.push({
                id: uuidV4(),
                name: file.name,
                type: "file",
                content: await readFileContent(file),
            })
        }
    }
    return children
}

/**
 * Unpack a .zip Blob into a FileSystemItem[] tree using JSZip.
 */
async function unpackZip(blob: Blob): Promise<FileSystemItem[]> {
    const zip = await JSZip.loadAsync(blob)
    // Build a path → node map
    const root: FileSystemItem[] = []
    const dirMap: Record<string, FileSystemItem> = {}

    const ensureDir = (segments: string[]): FileSystemItem => {
        const key = segments.join("/")
        if (dirMap[key]) return dirMap[key]
        const node: FileSystemItem = {
            id: uuidV4(),
            name: segments[segments.length - 1],
            type: "directory",
            children: [],
            isOpen: segments.length === 1,
        }
        dirMap[key] = node
        if (segments.length === 1) {
            root.push(node)
        } else {
            const parent = ensureDir(segments.slice(0, -1))
            parent.children!.push(node)
        }
        return node
    }

    const fileEntries: Array<{ path: string; zipObj: JSZip.JSZipObject }> = []
    zip.forEach((relativePath, zipObj) => {
        if (!zipObj.dir) fileEntries.push({ path: relativePath, zipObj })
    })

    await Promise.all(
        fileEntries.map(async ({ path, zipObj }) => {
            const parts = path.split("/").filter(Boolean)
            if (parts.some((p) => BLACKLIST.includes(p))) return
            const fileName = parts[parts.length - 1]
            const content = await zipObj.async("string").catch(() => "")
            const fileNode: FileSystemItem = {
                id: uuidV4(),
                name: fileName,
                type: "file",
                content,
            }
            if (parts.length === 1) {
                root.push(fileNode)
            } else {
                const parent = ensureDir(parts.slice(0, -1))
                parent.children!.push(fileNode)
            }
        }),
    )

    return root
}

// ── component ─────────────────────────────────────────────────────────────────

function FilesView() {
    const { downloadFilesAndFolders, updateDirectory } = useFileSystem()
    const { viewHeight, minHeightReached } = useResponsive()

    const [isLoading, setIsLoading] = useState(false)
    const [showSearch, setShowSearch] = useState(false)
    const [showNewProject, setShowNewProject] = useState(false)

    const zipInputRef = useRef<HTMLInputElement>(null)

    // ── open directory ────────────────────────────────────────────────────────
    const handleOpenDirectory = async () => {
        try {
            setIsLoading(true)
            if ("showDirectoryPicker" in window) {
                const handle = await window.showDirectoryPicker()
                toast.loading("Reading files…")
                const structure = await readDirectoryHandle(handle)
                updateDirectory("", structure)
                toast.dismiss()
                toast.success("Directory loaded")
                return
            }
            if ("webkitdirectory" in HTMLInputElement.prototype) {
                const input = document.createElement("input")
                input.type = "file"
                input.webkitdirectory = true
                input.onchange = async (e) => {
                    const files = (e.target as HTMLInputElement).files
                    if (files) {
                        toast.loading("Reading files…")
                        const structure = await readFileList(files)
                        updateDirectory("", structure)
                        toast.dismiss()
                        toast.success("Directory loaded")
                    }
                }
                input.click()
                return
            }
            toast.error("Your browser does not support directory selection.")
        } catch (err) {
            console.error(err)
            toast.dismiss()
            toast.error("Failed to open directory")
        } finally {
            setIsLoading(false)
        }
    }

    // ── zip import ────────────────────────────────────────────────────────────
    const handleZipImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        // Reset so same file can be re-selected
        e.target.value = ""

        const reader = new FileReader()
        toast.loading("Unpacking ZIP…")
        reader.onload = async (ev) => {
            try {
                const blob = new Blob([ev.target!.result as ArrayBuffer])
                const structure = await unpackZip(blob)
                updateDirectory("", structure)
                toast.dismiss()
                toast.success("ZIP imported successfully")
            } catch (err) {
                console.error(err)
                toast.dismiss()
                toast.error("Failed to unpack ZIP")
            }
        }
        reader.readAsArrayBuffer(file)
    }

    return (
        <>
            <div
                className="flex select-none flex-col gap-1 px-3 py-2"
                style={{ height: viewHeight, maxHeight: viewHeight }}
            >
                {/* ── Search panel (inline, collapses) ── */}
                {showSearch && (
                    <FileSearchPanel onClose={() => setShowSearch(false)} />
                )}

                {/* ── File tree ── */}
                <FileStructureView
                    onSearchOpen={() => setShowSearch((v) => !v)}
                    onNewProject={() => setShowNewProject(true)}
                />

                {/* ── Bottom actions ── */}
                <div
                    className={cn("flex min-h-fit flex-col justify-end pt-1", {
                        hidden: minHeightReached,
                    })}
                >
                    <div className="border-t border-darkHover pt-2">
                        <button
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-300 transition-colors hover:bg-darkHover hover:text-white"
                            onClick={handleOpenDirectory}
                            disabled={isLoading}
                        >
                            <TbFileUpload size={18} />
                            {isLoading ? "Loading…" : "Open Folder"}
                        </button>

                        {/* Hidden zip input */}
                        <input
                            ref={zipInputRef}
                            type="file"
                            accept=".zip"
                            className="hidden"
                            onChange={handleZipImport}
                        />
                        <button
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-300 transition-colors hover:bg-darkHover hover:text-white"
                            onClick={() => zipInputRef.current?.click()}
                        >
                            <LuPackageOpen size={16} />
                            Import ZIP
                        </button>

                        <button
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-300 transition-colors hover:bg-darkHover hover:text-white"
                            onClick={downloadFilesAndFolders}
                        >
                            <BiArchiveIn size={18} />
                            Download as ZIP
                        </button>
                    </div>
                </div>
            </div>

            {/* ── New Project Modal (portal-style, rendered at top level) ── */}
            {showNewProject && (
                <NewProjectModal onClose={() => setShowNewProject(false)} />
            )}
        </>
    )
}

export default FilesView
