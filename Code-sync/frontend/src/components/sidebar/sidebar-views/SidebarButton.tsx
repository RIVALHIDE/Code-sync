import { useChatRoom } from "@/context/ChatContext"
import { useViews } from "@/context/ViewContext"
import { VIEWS } from "@/types/view"

export const VIEW_LABELS: Record<VIEWS, string> = {
    [VIEWS.FILES]: "Files",
    [VIEWS.GITHUB]: "GitHub",
    [VIEWS.COPILOT]: "Copilot",
    [VIEWS.RUN]: "Run",
    [VIEWS.CHATS]: "Chat",
    [VIEWS.CLIENTS]: "People",
    [VIEWS.VIDEO_CALL]: "Video",
    [VIEWS.RECORDINGS]: "Recordings",
    [VIEWS.CO_PROMPT]: "Co-prompt",
    [VIEWS.VOICE]: "Voice",
    [VIEWS.DASHBOARD]: "Insights",
    [VIEWS.SETTINGS]: "Settings",
}

interface ViewButtonProps {
    viewName: VIEWS
    icon: JSX.Element
}

const ViewButton = ({ viewName, icon }: ViewButtonProps) => {
    const { activeView, setActiveView, isSidebarOpen, setIsSidebarOpen } =
        useViews()
    const { isNewMessage } = useChatRoom()
    const isActive = activeView === viewName && isSidebarOpen

    return (
        <button
            className={`workspace-tool ${isActive ? "is-active" : ""}`}
            onClick={() => {
                if (activeView === viewName) setIsSidebarOpen(!isSidebarOpen)
                else {
                    setActiveView(viewName)
                    setIsSidebarOpen(true)
                }
            }}
            aria-label={VIEW_LABELS[viewName]}
            aria-pressed={isActive}
            aria-controls="workspace-panel"
            title={VIEW_LABELS[viewName]}
        >
            {icon}
            <span>{VIEW_LABELS[viewName]}</span>
            {viewName === VIEWS.CHATS && isNewMessage && (
                <span className="unread-dot" aria-label="Unread messages" />
            )}
        </button>
    )
}

export default ViewButton
