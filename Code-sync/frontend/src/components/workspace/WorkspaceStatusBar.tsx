import { useAppContext } from "@/context/AppContext"
import { useFileSystem } from "@/context/FileContext"
import { useSettings } from "@/context/SettingContext"
import { useViews } from "@/context/ViewContext"
import { USER_STATUS } from "@/types/user"
import { VIEWS } from "@/types/view"
import { LuCheckCheck, LuCode2, LuRadio, LuSettings2 } from "react-icons/lu"

function WorkspaceStatusBar() {
    const { status, users, currentUser } = useAppContext()
    const { activeFile } = useFileSystem()
    const { language } = useSettings()
    const { setActiveView, setIsSidebarOpen } = useViews()
    const connected = status === USER_STATUS.JOINED

    return (
        <footer className="workspace-statusbar" aria-label="Workspace status">
            <div className="flex min-w-0 items-center gap-4">
                <span className={connected ? "status-connected" : ""}>
                    <LuRadio size={12} />
                    {connected ? "Connected to room" : "Connecting to room…"}
                </span>
                <span className="status-room" title={currentUser.roomId}>
                    Room / {currentUser.roomId.slice(0, 8)}
                </span>
                <span className="status-presence">
                    {users.length}{" "}
                    {users.length === 1 ? "participant" : "participants"}
                </span>
            </div>
            <div className="flex items-center gap-4">
                {connected && (
                    <span className="status-sharing">
                        <LuCheckCheck size={13} />
                        Live collaboration
                    </span>
                )}
                {activeFile && (
                    <span>
                        <LuCode2 size={12} />
                        {language}
                    </span>
                )}
                <button
                    onClick={() => {
                        setActiveView(VIEWS.SETTINGS)
                        setIsSidebarOpen(true)
                    }}
                    aria-label="Open editor settings"
                    title="Editor settings"
                >
                    <LuSettings2 size={13} />
                </button>
            </div>
        </footer>
    )
}

export default WorkspaceStatusBar
