import { useAppContext } from "@/context/AppContext"
import { useChatRoom } from "@/context/ChatContext"
import { SyntheticEvent, useEffect, useRef } from "react"

function ChatList() {
    const {
        messages,
        isNewMessage,
        setIsNewMessage,
        lastScrollHeight,
        setLastScrollHeight,
    } = useChatRoom()
    const { currentUser } = useAppContext()
    const messagesContainerRef = useRef<HTMLDivElement | null>(null)

    const handleScroll = (e: SyntheticEvent) => {
        const container = e.target as HTMLDivElement
        setLastScrollHeight(container.scrollTop)
    }

    // Scroll to bottom when messages change
    useEffect(() => {
        if (!messagesContainerRef.current) return
        messagesContainerRef.current.scrollTop =
            messagesContainerRef.current.scrollHeight
    }, [messages])

    useEffect(() => {
        if (isNewMessage) {
            setIsNewMessage(false)
        }
        if (messagesContainerRef.current)
            messagesContainerRef.current.scrollTop = lastScrollHeight
    }, [isNewMessage, setIsNewMessage, lastScrollHeight])

    return (
        <div
            className="sidebar-chat-list"
            ref={messagesContainerRef}
            onScroll={handleScroll}
        >
            {messages.length === 0 && (
                <div className="sidebar-panel-empty">
                    <p>No messages yet</p>
                    <span>Start a conversation with your room.</span>
                </div>
            )}
            {/* Chat messages */}
            {messages.map((message, index) => {
                return (
                    <div
                        key={index}
                        className={`sidebar-chat-message${message.username === currentUser.username ? " is-own" : ""}`}
                    >
                        <div className="sidebar-chat-meta">
                            <span className="sidebar-chat-author" title={message.username}>
                                {message.username}
                            </span>
                            <span className="sidebar-chat-time">
                                {message.timestamp}
                            </span>
                        </div>
                        <p className="sidebar-chat-text">{message.message}</p>
                    </div>
                )
            })}
        </div>
    )
}

export default ChatList
