import { useFileSystem } from "@/context/FileContext"
import { getIconClassName } from "@/utils/getIconClassName"
import { Icon } from "@iconify/react"
import { IoClose } from "react-icons/io5"
import cn from "classnames"
import { useEffect, useRef } from "react"

function FileTab() {
    const {
        openFiles,
        closeFile,
        activeFile,
        updateFileContent,
        setActiveFile,
    } = useFileSystem()
    const fileTabRef = useRef<HTMLDivElement>(null)

    const changeActiveFile = (fileId: string) => {
        if (activeFile?.id === fileId) return
        // Save current file content before switching
        updateFileContent(activeFile?.id || "", activeFile?.content || "")
        const file = openFiles.find((f) => f.id === fileId)
        if (file) setActiveFile(file)
    }

    // Horizontal scroll via mouse wheel
    useEffect(() => {
        const node = fileTabRef.current
        if (!node) return
        const handleWheel = (e: WheelEvent) => {
            node.scrollLeft += e.deltaY > 0 ? 100 : -100
        }
        node.addEventListener("wheel", handleWheel)
        return () => node.removeEventListener("wheel", handleWheel)
    }, [])

    return (
        <div className="editor-tabs" aria-label="Open files" ref={fileTabRef}>
            {openFiles.map((file) => {
                const isActive = file.id === activeFile?.id
                return (
                    <div
                        key={file.id}
                        className={cn("editor-tab group", {
                            "is-active": isActive,
                        })}
                    >
                        <button
                            className="editor-tab-select"
                            onClick={() => changeActiveFile(file.id)}
                            title={file.name}
                            aria-label={`Open ${file.name}`}
                            aria-pressed={isActive}
                        >
                            <Icon
                                icon={getIconClassName(file.name)}
                                fontSize={15}
                                className="flex-shrink-0"
                            />
                            <span className="truncate text-xs font-medium">
                                {file.name}
                            </span>
                            {/* Dirty indicator dot */}
                            {file.isDirty && (
                                <span
                                    className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary"
                                    title="Unsaved changes"
                                    aria-label="Unsaved changes"
                                />
                            )}
                        </button>
                        {/* Keep file switching and closing as separate keyboard-accessible buttons. */}
                        <button
                            className={cn(
                                "flex-shrink-0 rounded p-0.5 transition-colors",
                                isActive
                                    ? "text-gray-300 hover:bg-dark hover:text-white"
                                    : "text-transparent group-hover:text-gray-400 group-hover:hover:text-white",
                            )}
                            onClick={(e) => {
                                e.stopPropagation()
                                closeFile(file.id)
                            }}
                            aria-label={`Close ${file.name}`}
                        >
                            <IoClose size={14} />
                        </button>
                    </div>
                )
            })}
        </div>
    )
}

export default FileTab
