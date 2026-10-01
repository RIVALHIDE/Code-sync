import { useFileSystem } from "@/context/FileContext"
import { useViews } from "@/context/ViewContext"
import { VIEWS } from "@/types/view"
import { LuArrowRight, LuCode2, LuFolderOpen, LuSparkles } from "react-icons/lu"
import BreadcrumbBar from "./BreadcrumbBar"
import Editor from "./Editor"
import FileTab from "./FileTab"

function EditorComponent() {
    const { openFiles } = useFileSystem()
    const { setActiveView, setIsSidebarOpen } = useViews()
    const openPanel = (view: VIEWS) => {
        setActiveView(view)
        setIsSidebarOpen(true)
    }

    if (openFiles.length <= 0) {
        return (
            <main className="editor-empty-state">
                <div className="empty-state-mark">
                    <LuCode2 size={36} strokeWidth={1.5} />
                </div>
                <span className="workspace-eyebrow">
                    YOUR NEXT IDEA STARTS HERE
                </span>
                <h2>A little space for big ideas.</h2>
                <p>
                    Open a file, bring your team, and make something together.
                    <br />
                    Your workspace is ready when you are.
                </p>
                <div className="empty-state-actions">
                    <button onClick={() => openPanel(VIEWS.FILES)}>
                        <LuFolderOpen size={20} />
                        <span>
                            <strong>Explore your files</strong>
                            <small>Open a file or create a project</small>
                        </span>
                        <LuArrowRight size={16} />
                    </button>
                    <button onClick={() => openPanel(VIEWS.COPILOT)}>
                        <LuSparkles size={20} />
                        <span>
                            <strong>Start with Copilot</strong>
                            <small>Turn your next idea into code</small>
                        </span>
                        <LuArrowRight size={16} />
                    </button>
                </div>
                <span className="empty-state-note">
                    Built for the way you work. Better together.
                </span>
            </main>
        )
    }

    return (
        <main className="editor-surface" aria-label="Code editor">
            <FileTab />
            <BreadcrumbBar />
            <div className="editor-content">
                <Editor />
            </div>
        </main>
    )
}

export default EditorComponent
