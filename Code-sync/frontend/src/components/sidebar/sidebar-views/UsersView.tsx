import Users from "@/components/common/Users"
import { useAppContext } from "@/context/AppContext"
import { useSocket } from "@/context/SocketContext"
import useResponsive from "@/hooks/useResponsive"
import { USER_STATUS } from "@/types/user"
import toast from "react-hot-toast"
import { GoSignOut } from "react-icons/go"
import { IoShareOutline } from "react-icons/io5"
import { LuCopy } from "react-icons/lu"
import { useNavigate } from "react-router-dom"

function UsersView() {
    const navigate = useNavigate()
    const { viewHeight } = useResponsive()
    const { setStatus } = useAppContext()
    const { socket } = useSocket()

    const copyURL = async () => {
        const url = window.location.href
        try {
            await navigator.clipboard.writeText(url)
            toast.success("URL copied to clipboard")
        } catch (error) {
            toast.error("Unable to copy URL to clipboard")
            console.log(error)
        }
    }

    const shareURL = async () => {
        const url = window.location.href
        try {
            await navigator.share({ url })
        } catch (error) {
            toast.error("Unable to share URL")
            console.log(error)
        }
    }

    const leaveRoom = () => {
        socket.disconnect()
        setStatus(USER_STATUS.DISCONNECTED)
        navigate("/", {
            replace: true,
        })
    }

    return (
        <div className="sidebar-panel sidebar-panel--users" style={{ height: viewHeight }}>
            <div className="sidebar-panel-header">
                <h1 className="sidebar-panel-title">People in this room</h1>
            </div>
            {/* List of connected users */}
            <Users />
            <div className="sidebar-panel-footer">
                <div className="sidebar-users-actions">
                    {/* Share URL button */}
                    <button
                        className="sidebar-panel-button"
                        onClick={shareURL}
                        title="Share Link"
                    >
                        <IoShareOutline size={15} />
                        <span>Share</span>
                    </button>
                    {/* Copy URL button */}
                    <button
                        className="sidebar-panel-button"
                        onClick={copyURL}
                        title="Copy Link"
                    >
                        <LuCopy size={14} />
                        <span>Copy</span>
                    </button>
                    {/* Leave room button */}
                    <button
                        className="sidebar-panel-button sidebar-panel-button--danger"
                        onClick={leaveRoom}
                        title="Leave room"
                    >
                        <GoSignOut size={14} />
                        <span>Leave</span>
                    </button>
                </div>
            </div>
        </div>
    )
}

export default UsersView
