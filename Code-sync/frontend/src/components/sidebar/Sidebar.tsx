import SidebarButton, {
    VIEW_LABELS,
} from "@/components/sidebar/sidebar-views/SidebarButton"
import { useAppContext } from "@/context/AppContext"
import { useSocket } from "@/context/SocketContext"
import { useViews } from "@/context/ViewContext"
import useWindowDimensions from "@/hooks/useWindowDimensions"
import { ACTIVITY_STATE } from "@/types/app"
import { SocketEvent } from "@/types/socket"
import { VIEWS } from "@/types/view"
import { LuCode2, LuPenTool, LuPanelLeftClose, LuX, LuLogOut } from "react-icons/lu"
import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"

const toolGroups = [
    [VIEWS.FILES, VIEWS.GITHUB, VIEWS.COPILOT, VIEWS.RUN],
    [VIEWS.CHATS, VIEWS.CLIENTS, VIEWS.VIDEO_CALL, VIEWS.VOICE],
    [VIEWS.CO_PROMPT, VIEWS.RECORDINGS, VIEWS.DASHBOARD],
]

function Sidebar() {
    const {
        activeView,
        isSidebarOpen,
        viewComponents,
        viewIcons,
        setIsSidebarOpen,
    } = useViews()
    const { activityState, setActivityState } = useAppContext()
    const { socket } = useSocket()
    const { isMobile } = useWindowDimensions()
    const closeButton = useRef<HTMLButtonElement>(null)
    const navigate = useNavigate()

    const handleSignOut = () => {
        socket.emit(SocketEvent.USER_OFFLINE, { socketId: socket.id })
        socket.disconnect()
        navigate("/")
    }

    useEffect(() => {
        if (!isMobile || !isSidebarOpen) return
        const previouslyFocused = document.activeElement as HTMLElement | null
        closeButton.current?.focus()
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") setIsSidebarOpen(false)
        }
        window.addEventListener("keydown", closeOnEscape)
        return () => {
            window.removeEventListener("keydown", closeOnEscape)
            if (previouslyFocused?.isConnected) previouslyFocused.focus()
        }
    }, [isMobile, isSidebarOpen, setIsSidebarOpen])

    const changeActivity = () => {
        if (activityState === ACTIVITY_STATE.CODING) {
            setActivityState(ACTIVITY_STATE.DRAWING)
            socket.emit(SocketEvent.REQUEST_DRAWING)
        } else setActivityState(ACTIVITY_STATE.CODING)
        if (isMobile) setIsSidebarOpen(false)
    }

    return (
        <aside className="workspace-sidebar" aria-label="Workspace tools">
            <nav className="workspace-rail" aria-label="Workspace navigation">
                <div className="rail-tools">
                    {toolGroups.map((group, index) => (
                        <div className="rail-group" key={index}>
                            {group.map((view) => (
                                <SidebarButton
                                    key={view}
                                    viewName={view}
                                    icon={viewIcons[view]}
                                />
                            ))}
                        </div>
                    ))}
                </div>
                <div className="rail-utilities">
                    <button
                        className={`workspace-tool ${activityState === ACTIVITY_STATE.DRAWING ? "is-active" : ""}`}
                        onClick={changeActivity}
                        aria-label={
                            activityState === ACTIVITY_STATE.CODING
                                ? "Switch to whiteboard"
                                : "Switch to code editor"
                        }
                        title={
                            activityState === ACTIVITY_STATE.CODING
                                ? "Switch to whiteboard"
                                : "Switch to code editor"
                        }
                    >
                        {activityState === ACTIVITY_STATE.CODING ? (
                            <LuPenTool />
                        ) : (
                            <LuCode2 />
                        )}
                        <span>
                            {activityState === ACTIVITY_STATE.CODING
                                ? "Draw"
                                : "Code"}
                        </span>
                    </button>
                    <SidebarButton
                        viewName={VIEWS.SETTINGS}
                        icon={viewIcons[VIEWS.SETTINGS]}
                    />
                    <button
                        className="workspace-tool"
                        onClick={handleSignOut}
                        aria-label="Sign out of room"
                        title="Sign out"
                    >
                        <LuLogOut />
                        <span>Sign out</span>
                    </button>
                </div>
            </nav>
            {isSidebarOpen && (
                <>
                    {isMobile && (
                        <button
                            className="panel-backdrop"
                            aria-label="Dismiss tools panel"
                            onClick={() => setIsSidebarOpen(false)}
                        />
                    )}
                    <section
                        id="workspace-panel"
                        className="workspace-panel"
                        aria-label={`${VIEW_LABELS[activeView]} panel`}
                    >
                        <div className="workspace-panel-heading">
                            <span>
                                <span className="panel-heading-dot" />
                                {VIEW_LABELS[activeView]}
                                <span className="panel-heading-caption">
                                    {" "}
                                    / workspace
                                </span>
                            </span>
                            <button
                                ref={closeButton}
                                className="workspace-icon-button"
                                onClick={() => setIsSidebarOpen(false)}
                                aria-label="Close tools panel"
                                title="Close tools panel"
                            >
                                {isMobile ? (
                                    <LuX size={16} />
                                ) : (
                                    <LuPanelLeftClose size={16} />
                                )}
                            </button>
                        </div>
                        <div
                            className="workspace-panel-content"
                            id="workspace-panel-content"
                        >
                            {viewComponents[activeView]}
                        </div>
                    </section>
                </>
            )}
        </aside>
    )
}

export default Sidebar
