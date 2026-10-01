import { useAppContext } from "@/context/AppContext"
import { useFileSystem } from "@/context/FileContext"
import { useRunCode } from "@/context/RunCodeContext"
import { useSettings } from "@/context/SettingContext"
import { useViews } from "@/context/ViewContext"
import { ACTIVITY_STATE } from "@/types/app"
import { USER_STATUS } from "@/types/user"
import { VIEWS } from "@/types/view"
import toast from "react-hot-toast"
import {
    LuArrowUpRight,
    LuCheck,
    LuCode2,
    LuGithub,
    LuLink,
    LuLoader2,
    LuPanelLeft,
    LuPlay,
    LuUsers,
} from "react-icons/lu"
import { useState } from "react"

function WorkspaceHeader() {
    const { currentUser, users, status, setActivityState } = useAppContext()
    const { activeFile } = useFileSystem()
    const { isRunning, runCode } = useRunCode()
    const { showGitHubCorner } = useSettings()
    const { isSidebarOpen, setIsSidebarOpen, setActiveView } = useViews()
    const [copied, setCopied] = useState(false)
    const connected = status === USER_STATUS.JOINED

    const invite = async () => {
        try {
            // Do not include a username from a direct-join URL in another person's invite.
            const url = new URL(window.location.href)
            url.search = ""
            url.hash = ""
            await navigator.clipboard.writeText(url.toString())
            setCopied(true)
            toast.success("Invite link copied. Share it with your teammates.")
        } catch {
            toast.error(
                "Couldn't copy the invite link. Copy the address from your browser.",
            )
        }
    }

    const run = () => {
        setActivityState(ACTIVITY_STATE.CODING)
        setActiveView(VIEWS.RUN)
        setIsSidebarOpen(true)
        void runCode()
    }

    return (
        <header className="workspace-header">
            <a className="workspace-brand" href="/" aria-label="CodeSync home">
                <span className="workspace-brand-mark">
                    <LuCode2 size={22} />
                </span>
                <span>
                    code<span className="text-emerald-400">sync</span>
                    <span className="brand-period">.</span>
                </span>
            </a>
            <span className="header-divider" />
            <div className="workspace-heading">
                <div className="flex items-center gap-2">
                    <h1>Workspace</h1>
                    <span
                        className={`session-badge ${connected ? "is-connected" : ""}`}
                        role="status"
                    >
                        <span className="status-dot" />
                        {connected ? "Live" : "Connecting"}
                    </span>
                </div>
                <p>Build something great, together.</p>
            </div>
            <div className="workspace-header-actions">
                <button
                    className="workspace-icon-button mobile-panel-toggle"
                    aria-label={
                        isSidebarOpen ? "Close tools panel" : "Open tools panel"
                    }
                    aria-expanded={isSidebarOpen}
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                >
                    <LuPanelLeft size={18} />
                </button>
                <button
                    className="collaborators-button"
                    onClick={() => {
                        setActiveView(VIEWS.CLIENTS)
                        setIsSidebarOpen(true)
                    }}
                    title="View participants"
                    aria-label={`View participants (${users.length})`}
                >
                    <span className="avatar-stack">
                        {users.slice(0, 3).map((user, index) => (
                            <span
                                className={`participant-avatar avatar-${index}`}
                                key={user.socketId}
                                title={user.username}
                            >
                                {user.username.slice(0, 2).toUpperCase()}
                            </span>
                        ))}
                        {users.length === 0 && (
                            <span className="participant-avatar">
                                {currentUser.username
                                    .slice(0, 2)
                                    .toUpperCase() || <LuUsers size={14} />}
                            </span>
                        )}
                    </span>
                    <span className="collaborator-count">
                        {users.length > 3 ? (
                            `+${users.length - 3}`
                        ) : (
                            <LuUsers size={16} />
                        )}
                    </span>
                </button>
                {showGitHubCorner && (
                    <a
                        className="workspace-icon-button source-link"
                        href="https://github.com/RIVALHIDE/Code-Sync"
                        target="_blank"
                        rel="noreferrer"
                        aria-label="View source on GitHub"
                        title="View source on GitHub"
                    >
                        <LuGithub size={18} />
                    </a>
                )}
                <button
                    className="workspace-button invite-button"
                    onClick={invite}
                    onBlur={() => setCopied(false)}
                >
                    {copied ? <LuCheck size={15} /> : <LuLink size={15} />}
                    <span>{copied ? "Copied!" : "Invite"}</span>
                    <LuArrowUpRight size={13} className="invite-arrow" />
                </button>
                <button
                    className="workspace-button workspace-button-primary"
                    onClick={run}
                    disabled={!activeFile || isRunning}
                    title={
                        activeFile
                            ? "Run the current file"
                            : "Open a file to run code"
                    }
                >
                    {isRunning ? (
                        <LuLoader2 size={15} className="animate-spin" />
                    ) : (
                        <LuPlay size={15} />
                    )}
                    <span>{isRunning ? "Running…" : "Run code"}</span>
                </button>
            </div>
        </header>
    )
}

export default WorkspaceHeader
