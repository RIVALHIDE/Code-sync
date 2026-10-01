import { useAppContext } from "@/context/AppContext"
import { RemoteUser, USER_CONNECTION_STATUS } from "@/types/user"
import Avatar from "react-avatar"

function Users() {
    const { users } = useAppContext()

    return (
        <div className="sidebar-users-list">
            <div className="sidebar-users-grid">
                {users.map((user) => {
                    return <User key={user.socketId} user={user} />
                })}
            </div>
        </div>
    )
}

const User = ({ user }: { user: RemoteUser }) => {
    const { username, status } = user
    const title = `${username} - ${status === USER_CONNECTION_STATUS.ONLINE ? "online" : "offline"}`

    return (
        <div
            className="sidebar-user"
            title={title}
        >
            <Avatar name={username} size="32" textSizeRatio={2.5} round="8px" title={title} />
            <div className="sidebar-user-details">
                <p className="sidebar-user-name">{username}</p>
                <span className="sidebar-user-presence">
                    <span
                        className={`sidebar-user-dot ${status === USER_CONNECTION_STATUS.ONLINE ? "is-online" : "is-offline"}`}
                        aria-hidden="true"
                    />
                    {status === USER_CONNECTION_STATUS.ONLINE ? "Online" : "Offline"}
                </span>
            </div>
        </div>
    )
}

export default Users
