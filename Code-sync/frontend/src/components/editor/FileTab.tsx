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
        <div
            className="flex h-[46px] w-full select-none gap-1 overflow-x-auto border-b border-darkHover bg-dark px-2 pb-0 pt-1.5"
            ref={fileTabRef}
        >
            {openFiles.map((file) => {
                const isActive = file.id === activeFile?.id
                return (
                    <span
                        key={file.id}
                        className={cn(
                            "group flex w-fit max-w-[180px] cursor-pointer items-center gap-1.5 rounded-t-md border-t-2 px-3 py-1 text-sm transition-colors",
                            isActive
                                ? "border-primary bg-darkHover text-white"
                                : "border-transparent text-gray-400 hover:bg-darkHover/50 hover:text-gray-200",
                        )}
                        onClick={() => changeActiveFile(file.id)}
                        title={file.name}
                    >
                        <Icon
                            icon={getIconClassName(file.name)}
                            fontSize={15}
                            className="flex-shrink-0"
                        />
                        <p className="flex-grow truncate text-xs font-medium">
                            {file.name}
                        </p>
                        {/* Dirty indicator dot */}
                        {file.isDirty && (
                            <span
                                className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary"
                                title="Unsaved changes"
                                aria-label="Unsaved changes"
                            />
                        )}
                        {/* Close button — always visible on active, hover-visible otherwise */}
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
                    </span>
                )
            })}
        </div>
    )
}

export default FileTab
