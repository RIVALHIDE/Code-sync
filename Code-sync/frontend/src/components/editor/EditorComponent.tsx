import { useFileSystem } from "@/context/FileContext"
import useResponsive from "@/hooks/useResponsive"
import cn from "classnames"
import { LuFileCode2 } from "react-icons/lu"
import BreadcrumbBar from "./BreadcrumbBar"
import Editor from "./Editor"
import FileTab from "./FileTab"

function EditorComponent() {
    const { openFiles } = useFileSystem()
    const { minHeightReached } = useResponsive()

    if (openFiles.length <= 0) {
        return (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-gray-500">
                <LuFileCode2 size={40} className="opacity-30" />
                <p className="text-sm">No file is open.</p>
                <p className="text-xs text-gray-600">
                    Select a file from the sidebar or create a new one.
                </p>
            </div>
        )
    }

    return (
        <main
            className={cn("flex w-full flex-col overflow-hidden md:h-screen", {
                "h-[calc(100vh-50px)]": !minHeightReached,
                "h-full": minHeightReached,
            })}
        >
            <FileTab />
            <BreadcrumbBar />
            <Editor />
        </main>
    )
}

export default EditorComponent
