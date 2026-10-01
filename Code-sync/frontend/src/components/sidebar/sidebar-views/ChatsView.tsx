import ChatInput from "@/components/chats/ChatInput"
import ChatList from "@/components/chats/ChatList"
import useResponsive from "@/hooks/useResponsive"
import "@/styles/sidebar-panels.css"

const ChatsView = () => {
    const { viewHeight } = useResponsive()

    return (
        <div
            className="sidebar-panel sidebar-panel--chat"
            style={{ height: viewHeight }}
        >
            <div className="sidebar-panel-header">
                <h1 className="sidebar-panel-title">Group Chat</h1>
            </div>
            {/* Chat list */}
            <ChatList />
            {/* Chat input */}
            <ChatInput />
        </div>
    )
}

export default ChatsView
