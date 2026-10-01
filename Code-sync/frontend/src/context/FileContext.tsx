import {
    FileContent,
    FileContext as FileContextType,
    FileName,
    FileSystemItem,
    Id,
} from "@/types/file"
import { SocketEvent } from "@/types/socket"
import { RemoteUser } from "@/types/user"
import {
    findParentDirectory,
    getFileById,
    initialFileStructure,
    isFileExist,
} from "@/utils/file"
import customMapping from "@/utils/customMapping"
import { saveAs } from "file-saver"
import JSZip from "jszip"
import langMap from "lang-map"
import {
    ReactNode,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react"
import { toast } from "react-hot-toast"
import { v4 as uuidv4 } from "uuid"
import { useAppContext } from "./AppContext"
import { useSocket } from "./SocketContext"
import { useSettings } from "./SettingContext"

const FileContext = createContext<FileContextType | null>(null)

export const useFileSystem = (): FileContextType => {
    const context = useContext(FileContext)
    if (!context) {
        throw new Error("useFileSystem must be used within FileContextProvider")
    }
    return context
}

// ── language detection helper ─────────────────────────────────────────────────

function detectLanguage(fileName: string): string {
    const ext = fileName.split(".").pop()?.toLowerCase() ?? ""
    if (customMapping[ext]) return customMapping[ext]
    const langs = langMap.languages(ext)
    return langs[0] ?? ""
}

// ── path helper (walk tree to find path) ─────────────────────────────────────

function findPath(
    node: FileSystemItem,
    targetId: Id,
    current: string,
): string | null {
    const here = current ? `${current}/${node.name}` : node.name
    if (node.id === targetId) return here
    for (const child of node.children ?? []) {
        const result = findPath(child, targetId, here)
        if (result) return result
    }
    return null
}

// ── provider ──────────────────────────────────────────────────────────────────

function FileContextProvider({ children }: { children: ReactNode }) {
    const { socket } = useSocket()
    const { setUsers, drawingData } = useAppContext()
    const { setLanguage } = useSettings()

    const [fileStructure, setFileStructure] =
        useState<FileSystemItem>(initialFileStructure)
    const initialOpenFiles = fileStructure.children ?? []
    const [openFiles, setOpenFiles] =
        useState<FileSystemItem[]>(initialOpenFiles)
    const [activeFile, setActiveFile] = useState<FileSystemItem | null>(
        openFiles[0] ?? null,
    )

    // ── apply language from active file ──────────────────────────────────────
    useEffect(() => {
        if (!activeFile?.name) return
        const lang = detectLanguage(activeFile.name)
        if (lang) setLanguage(lang)
    }, [activeFile?.id, activeFile?.name, setLanguage])

    // ── getFilePath ───────────────────────────────────────────────────────────
    const getFilePath = useCallback(
        (fileId: Id): string => {
            const result = findPath(fileStructure, fileId, "")
            if (!result) return ""
            // Strip the virtual "root/" prefix
            return result.startsWith("root/") ? result.slice(5) : result
        },
        [fileStructure],
    )

    // ── toggleDirectory ───────────────────────────────────────────────────────
    const toggleDirectory = (dirId: Id) => {
        const toggleDir = (directory: FileSystemItem): FileSystemItem => {
            if (directory.id === dirId) {
                return { ...directory, isOpen: !directory.isOpen }
            } else if (directory.children) {
                return {
                    ...directory,
                    children: directory.children.map(toggleDir),
                }
            }
            return directory
        }
        setFileStructure((prev) => toggleDir(prev))
    }

    const collapseDirectories = () => {
        const collapseDir = (directory: FileSystemItem): FileSystemItem => ({
            ...directory,
            isOpen: false,
            children: directory.children?.map(collapseDir),
        })
        setFileStructure((prev) => collapseDir(prev))
    }

    // ── createDirectory ───────────────────────────────────────────────────────
    const createDirectory = useCallback(
        (
            parentDirId: string,
            newDir: string | FileSystemItem,
            sendToSocket: boolean = true,
        ) => {
            let newDirectory: FileSystemItem
            if (typeof newDir === "string") {
                newDirectory = {
                    id: uuidv4(),
                    name: newDir,
                    type: "directory",
                    children: [],
                    isOpen: false,
                }
            } else {
                newDirectory = newDir
            }

            if (!parentDirId) parentDirId = fileStructure.id

            const addDirectoryToParent = (
                directory: FileSystemItem,
            ): FileSystemItem => {
                if (directory.id === parentDirId) {
                    return {
                        ...directory,
                        children: [...(directory.children || []), newDirectory],
                    }
                } else if (directory.children) {
                    return {
                        ...directory,
                        children: directory.children.map(addDirectoryToParent),
                    }
                }
                return directory
            }

            setFileStructure((prev) => addDirectoryToParent(prev))

            if (!sendToSocket) return newDirectory.id
            socket.emit(SocketEvent.DIRECTORY_CREATED, {
                parentDirId,
                newDirectory,
            })

            return newDirectory.id
        },
        [fileStructure.id, socket],
    )

    // ── updateDirectory ───────────────────────────────────────────────────────
    const updateDirectory = useCallback(
        (
            dirId: string,
            children: FileSystemItem[],
            sendToSocket: boolean = true,
        ) => {
            if (!dirId) dirId = fileStructure.id

            const updateChildren = (
                directory: FileSystemItem,
            ): FileSystemItem => {
                if (directory.id === dirId) {
                    return { ...directory, children }
                } else if (directory.children) {
                    return {
                        ...directory,
                        children: directory.children.map(updateChildren),
                    }
                }
                return directory
            }

            setFileStructure((prev) => updateChildren(prev))
            setOpenFiles([])
            setActiveFile(null)

            if (dirId === fileStructure.id) {
                toast.dismiss()
                toast.success("Files and folders updated")
            }

            if (!sendToSocket) return
            socket.emit(SocketEvent.DIRECTORY_UPDATED, { dirId, children })
        },
        [fileStructure.id, socket],
    )

    // ── renameDirectory ───────────────────────────────────────────────────────
    const renameDirectory = useCallback(
        (
            dirId: string,
            newDirName: string,
            sendToSocket: boolean = true,
        ): boolean => {
            const renameInDirectory = (
                directory: FileSystemItem,
            ): FileSystemItem | null => {
                if (directory.type === "directory" && directory.children) {
                    const isNameTaken = directory.children.some(
                        (item) =>
                            item.type === "directory" &&
                            item.name === newDirName &&
                            item.id !== dirId,
                    )
                    if (isNameTaken) return null

                    return {
                        ...directory,
                        children: directory.children.map((item) => {
                            if (item.id === dirId) {
                                return { ...item, name: newDirName }
                            } else if (item.type === "directory") {
                                const updated = renameInDirectory(item)
                                return updated !== null ? updated : item
                            }
                            return item
                        }),
                    }
                }
                return directory
            }

            const updated = renameInDirectory(fileStructure)
            if (updated === null) return false

            setFileStructure(updated)

            if (!sendToSocket) return true
            socket.emit(SocketEvent.DIRECTORY_RENAMED, { dirId, newDirName })
            return true
        },
        [socket, fileStructure],
    )

    // ── deleteDirectory ───────────────────────────────────────────────────────
    const deleteDirectory = useCallback(
        (dirId: string, sendToSocket: boolean = true) => {
            const deleteFromDirectory = (
                directory: FileSystemItem,
            ): FileSystemItem | null => {
                if (directory.type === "directory" && directory.id === dirId) {
                    return null
                } else if (directory.children) {
                    const updatedChildren = directory.children
                        .map(deleteFromDirectory)
                        .filter((item) => item !== null) as FileSystemItem[]
                    return { ...directory, children: updatedChildren }
                }
                return directory
            }

            setFileStructure(
                (prev) => deleteFromDirectory(prev)!,
            )

            if (!sendToSocket) return
            socket.emit(SocketEvent.DIRECTORY_DELETED, { dirId })
        },
        [socket],
    )

    // ── openFile ──────────────────────────────────────────────────────────────
    const openFile = useCallback(
        (fileId: Id) => {
            const file = getFileById(fileStructure, fileId)
            if (!file) return

            // Persist current active file content back to tree
            updateFileContent(activeFile?.id || "", activeFile?.content || "")

            if (!openFiles.some((f) => f.id === fileId)) {
                setOpenFiles((prev) => [...prev, file])
            }

            // Sync active file content in openFiles list
            setOpenFiles((prev) =>
                prev.map((f) =>
                    f.id === activeFile?.id
                        ? { ...f, content: activeFile.content || "" }
                        : f,
                ),
            )

            setActiveFile(file)
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [fileStructure, openFiles, activeFile],
    )

    // ── closeFile ─────────────────────────────────────────────────────────────
    const closeFile = useCallback(
        (fileId: Id) => {
            if (fileId === activeFile?.id) {
                updateFileContent(activeFile.id, activeFile.content || "")
                const idx = openFiles.findIndex((f) => f.id === fileId)
                if (idx !== -1 && openFiles.length > 1) {
                    setActiveFile(openFiles[idx > 0 ? idx - 1 : idx + 1])
                } else {
                    setActiveFile(null)
                }
            }
            setOpenFiles((prev) => prev.filter((f) => f.id !== fileId))
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [activeFile, openFiles],
    )

    // ── createFile ────────────────────────────────────────────────────────────
    const createFile = useCallback(
        (
            parentDirId: string,
            file: FileName | FileSystemItem,
            sendToSocket: boolean = true,
        ): Id => {
            let num = 1
            if (!parentDirId) parentDirId = fileStructure.id

            const parentDir = findParentDirectory(fileStructure, parentDirId)
            if (!parentDir) throw new Error("Parent directory not found")

            let newFile: FileSystemItem

            if (typeof file === "string") {
                let name = file
                let fileExists = isFileExist(parentDir, name)
                while (fileExists) {
                    const parts = name.split(".")
                    const ext = parts.length > 1 ? parts.pop() : ""
                    const base = parts.join(".")
                    name = ext ? `${base}(${num}).${ext}` : `${base}(${num})`
                    fileExists = isFileExist(parentDir, name)
                    num++
                }

                newFile = {
                    id: uuidv4(),
                    name,
                    type: "file",
                    content: "",
                    isDirty: false,
                }
            } else {
                newFile = file
            }

            const addToParent = (directory: FileSystemItem): FileSystemItem => {
                if (directory.id === parentDir.id) {
                    return {
                        ...directory,
                        children: [...(directory.children || []), newFile],
                        isOpen: true,
                    }
                } else if (directory.children) {
                    return {
                        ...directory,
                        children: directory.children.map(addToParent),
                    }
                }
                return directory
            }

            setFileStructure((prev) => addToParent(prev))
            setOpenFiles((prev) => [...prev, newFile])
            setActiveFile(newFile)

            if (!sendToSocket) return newFile.id
            socket.emit(SocketEvent.FILE_CREATED, { parentDirId, newFile })
            return newFile.id
        },
        [fileStructure, socket],
    )

    // ── updateFileContent ────────────────────────────────────────────────────
    const updateFileContent = useCallback(
        (fileId: string, newContent: string) => {
            const updateFile = (directory: FileSystemItem): FileSystemItem => {
                if (directory.type === "file" && directory.id === fileId) {
                    return {
                        ...directory,
                        content: newContent,
                        isDirty: directory.content !== newContent,
                    }
                } else if (directory.children) {
                    return {
                        ...directory,
                        children: directory.children.map(updateFile),
                    }
                }
                return directory
            }

            setFileStructure((prev) => updateFile(prev))

            if (openFiles.some((f) => f.id === fileId)) {
                setOpenFiles((prev) =>
                    prev.map((f) =>
                        f.id === fileId
                            ? {
                                  ...f,
                                  content: newContent,
                                  isDirty: f.content !== newContent,
                              }
                            : f,
                    ),
                )
            }
        },
        [openFiles],
    )

    // ── renameFile (with duplicate-name guard) ────────────────────────────────
    const renameFile = useCallback(
        (
            fileId: string,
            newName: string,
            sendToSocket: boolean = true,
        ): boolean => {
            // Guard: check for duplicate name in the same parent directory
            let duplicateFound = false
            const checkAndRename = (
                directory: FileSystemItem,
            ): FileSystemItem => {
                if (directory.type === "directory" && directory.children) {
                    // Check if any sibling has the new name
                    const hasDuplicate = directory.children.some(
                        (item) =>
                            item.type === "file" &&
                            item.name === newName &&
                            item.id !== fileId,
                    )
                    // Does this directory contain the file being renamed?
                    const containsTarget = directory.children.some(
                        (item) => item.id === fileId,
                    )
                    if (containsTarget && hasDuplicate) {
                        duplicateFound = true
                        return directory
                    }

                    return {
                        ...directory,
                        children: directory.children.map((item) => {
                            if (item.type === "file" && item.id === fileId) {
                                return { ...item, name: newName }
                            } else if (item.type === "directory") {
                                return checkAndRename(item)
                            }
                            return item
                        }),
                    }
                }
                return directory
            }

            const updated = checkAndRename(fileStructure)
            if (duplicateFound) return false

            setFileStructure(updated)

            setOpenFiles((prev) =>
                prev.map((f) => (f.id === fileId ? { ...f, name: newName } : f)),
            )

            if (fileId === activeFile?.id) {
                setActiveFile((prev) =>
                    prev ? { ...prev, name: newName } : null,
                )
            }

            if (!sendToSocket) return true
            socket.emit(SocketEvent.FILE_RENAMED, { fileId, newName })
            return true
        },
        [activeFile?.id, fileStructure, socket],
    )

    // ── deleteFile ────────────────────────────────────────────────────────────
    const deleteFile = useCallback(
        (fileId: string, sendToSocket: boolean = true) => {
            const deleteFromDir = (
                directory: FileSystemItem,
            ): FileSystemItem => {
                if (directory.type === "directory" && directory.children) {
                    const updated = directory.children
                        .map((child) => {
                            if (child.type === "directory") {
                                return deleteFromDir(child)
                            }
                            return child.id !== fileId ? child : null
                        })
                        .filter(Boolean) as FileSystemItem[]
                    return { ...directory, children: updated }
                }
                return directory
            }

            setFileStructure((prev) => deleteFromDir(prev))

            if (openFiles.some((f) => f.id === fileId)) {
                setOpenFiles((prev) => prev.filter((f) => f.id !== fileId))
            }

            if (activeFile?.id === fileId) setActiveFile(null)

            toast.success("File deleted successfully")

            if (!sendToSocket) return
            socket.emit(SocketEvent.FILE_DELETED, { fileId })
        },
        [activeFile?.id, openFiles, socket],
    )

    // ── downloadFilesAndFolders ───────────────────────────────────────────────
    const downloadFilesAndFolders = () => {
        const zip = new JSZip()

        const downloadRecursive = (
            item: FileSystemItem,
            parentPath: string = "",
        ) => {
            const currentPath =
                parentPath + item.name + (item.type === "directory" ? "/" : "")

            if (item.type === "file") {
                zip.file(currentPath, item.content || "")
            } else if (item.type === "directory" && item.children) {
                for (const child of item.children) {
                    downloadRecursive(child, currentPath)
                }
            }
        }

        if (fileStructure.type === "directory" && fileStructure.children) {
            for (const child of fileStructure.children) {
                downloadRecursive(child)
            }
        }

        zip.generateAsync({ type: "blob" }).then((content) => {
            saveAs(content, "project.zip")
        })
    }

    // ── socket handlers ───────────────────────────────────────────────────────

    const handleUserJoined = useCallback(
        ({ user }: { user: RemoteUser }) => {
            toast.success(`${user.username} joined the room`)
            socket.emit(SocketEvent.SYNC_FILE_STRUCTURE, {
                fileStructure,
                openFiles,
                activeFile,
                socketId: user.socketId,
            })
            socket.emit(SocketEvent.SYNC_DRAWING, {
                drawingData,
                socketId: user.socketId,
            })
            setUsers((prev) => [...prev, user])
        },
        [activeFile, drawingData, fileStructure, openFiles, setUsers, socket],
    )

    const handleFileStructureSync = useCallback(
        ({
            fileStructure: fs,
            openFiles: of_,
            activeFile: af,
        }: {
            fileStructure: FileSystemItem
            openFiles: FileSystemItem[]
            activeFile: FileSystemItem | null
        }) => {
            setFileStructure(fs)
            setOpenFiles(of_)
            setActiveFile(af)
            toast.dismiss()
        },
        [],
    )

    const handleDirCreated = useCallback(
        ({
            parentDirId,
            newDirectory,
        }: {
            parentDirId: Id
            newDirectory: FileSystemItem
        }) => {
            createDirectory(parentDirId, newDirectory, false)
        },
        [createDirectory],
    )

    const handleDirUpdated = useCallback(
        ({ dirId, children }: { dirId: Id; children: FileSystemItem[] }) => {
            updateDirectory(dirId, children, false)
        },
        [updateDirectory],
    )

    const handleDirRenamed = useCallback(
        ({ dirId, newName }: { dirId: Id; newName: FileName }) => {
            renameDirectory(dirId, newName, false)
        },
        [renameDirectory],
    )

    const handleDirDeleted = useCallback(
        ({ dirId }: { dirId: Id }) => {
            deleteDirectory(dirId, false)
        },
        [deleteDirectory],
    )

    const handleFileCreated = useCallback(
        ({
            parentDirId,
            newFile,
        }: {
            parentDirId: Id
            newFile: FileSystemItem
        }) => {
            createFile(parentDirId, newFile, false)
        },
        [createFile],
    )

    const handleFileUpdated = useCallback(
        ({ fileId, newContent }: { fileId: Id; newContent: FileContent }) => {
            updateFileContent(fileId, newContent)
            if (activeFile?.id === fileId) {
                setActiveFile({ ...activeFile, content: newContent })
            }
        },
        [activeFile, updateFileContent],
    )

    const handleFileRenamed = useCallback(
        ({ fileId, newName }: { fileId: string; newName: FileName }) => {
            renameFile(fileId, newName, false)
        },
        [renameFile],
    )

    const handleFileDeleted = useCallback(
        ({ fileId }: { fileId: Id }) => {
            deleteFile(fileId, false)
        },
        [deleteFile],
    )

    useEffect(() => {
        socket.once(SocketEvent.SYNC_FILE_STRUCTURE, handleFileStructureSync)
        socket.on(SocketEvent.USER_JOINED, handleUserJoined)
        socket.on(SocketEvent.DIRECTORY_CREATED, handleDirCreated)
        socket.on(SocketEvent.DIRECTORY_UPDATED, handleDirUpdated)
        socket.on(SocketEvent.DIRECTORY_RENAMED, handleDirRenamed)
        socket.on(SocketEvent.DIRECTORY_DELETED, handleDirDeleted)
        socket.on(SocketEvent.FILE_CREATED, handleFileCreated)
        socket.on(SocketEvent.FILE_UPDATED, handleFileUpdated)
        socket.on(SocketEvent.FILE_RENAMED, handleFileRenamed)
        socket.on(SocketEvent.FILE_DELETED, handleFileDeleted)

        return () => {
            socket.off(SocketEvent.USER_JOINED)
            socket.off(SocketEvent.DIRECTORY_CREATED)
            socket.off(SocketEvent.DIRECTORY_UPDATED)
            socket.off(SocketEvent.DIRECTORY_RENAMED)
            socket.off(SocketEvent.DIRECTORY_DELETED)
            socket.off(SocketEvent.FILE_CREATED)
            socket.off(SocketEvent.FILE_UPDATED)
            socket.off(SocketEvent.FILE_RENAMED)
            socket.off(SocketEvent.FILE_DELETED)
        }
    }, [
        handleDirCreated,
        handleDirDeleted,
        handleDirRenamed,
        handleDirUpdated,
        handleFileCreated,
        handleFileDeleted,
        handleFileRenamed,
        handleFileStructureSync,
        handleFileUpdated,
        handleUserJoined,
        socket,
    ])

    return (
        <FileContext.Provider
            value={{
                fileStructure,
                openFiles,
                activeFile,
                setActiveFile,
                closeFile,
                toggleDirectory,
                collapseDirectories,
                createDirectory,
                updateDirectory,
                renameDirectory,
                deleteDirectory,
                openFile,
                createFile,
                updateFileContent,
                renameFile,
                deleteFile,
                downloadFilesAndFolders,
                getFilePath,
            }}
        >
            {children}
        </FileContext.Provider>
    )
}

export { FileContextProvider }
export default FileContext
