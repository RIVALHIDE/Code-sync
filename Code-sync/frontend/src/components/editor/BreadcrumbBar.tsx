import { useFileSystem } from "@/context/FileContext"
import { getIconClassName } from "@/utils/getIconClassName"
import { Icon } from "@iconify/react"
import { LuChevronRight } from "react-icons/lu"

function BreadcrumbBar() {
    const { activeFile, getFilePath } = useFileSystem()

    if (!activeFile) return null

    const fullPath = getFilePath(activeFile.id) || activeFile.name
    const parts = fullPath.split("/").filter(Boolean)

    return (
        <div
            className="flex h-[28px] select-none items-center gap-0.5 overflow-x-auto border-b border-darkHover bg-dark/80 px-3"
            aria-label="File path"
        >
            {parts.map((part, i) => {
                const isLast = i === parts.length - 1
                const isFile = isLast && activeFile.type === "file"
                return (
                    <span key={i} className="flex items-center gap-0.5">
                        {i > 0 && (
                            <LuChevronRight
                                size={11}
                                className="flex-shrink-0 text-gray-600"
                            />
                        )}
                        <span
                            className={`flex items-center gap-1 whitespace-nowrap text-[11px] ${
                                isLast
                                    ? "font-medium text-gray-200"
                                    : "text-gray-500"
                            }`}
                        >
                            {isFile && (
                                <Icon
                                    icon={getIconClassName(part)}
                                    fontSize={12}
                                    className="flex-shrink-0"
                                />
                            )}
                            {part}
                        </span>
                    </span>
                )
            })}
        </div>
    )
}

export default BreadcrumbBar
