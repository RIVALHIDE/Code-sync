import { callAIProxy } from "@/api/aiApi"
import { SocketEvent } from "@/types/socket"
import {
    CoPromptContext as CoPromptContextType,
    LinkedCodeBlock,
    PromptCursor,
    PromptHistoryEntry,
} from "@/types/coPrompt"
import {
    ReactNode,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react"
import toast from "react-hot-toast"
import { v4 as uuidv4 } from "uuid"
import { useAppContext } from "./AppContext"
import { useFileSystem } from "./FileContext"
import { useSocket } from "./SocketContext"
import { useSettings } from "./SettingContext"

const CoPromptContext = createContext<CoPromptContextType | null>(null)

export const useCoPrompt = (): CoPromptContextType => {
    const context = useContext(CoPromptContext)
    if (!context) throw new Error("useCoPrompt must be used within CoPromptContextProvider")
    return context
}

// Assign a stable color per username
const CURSOR_COLORS = [
    "#f59e0b", "#10b981", "#3b82f6", "#ec4899",
    "#8b5cf6", "#f97316", "#06b6d4", "#84cc16",
]
function colorForUser(username: string): string {
    let hash = 0
    for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash)
    return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]
}

const SYSTEM_PROMPT = `You are a collaborative AI assistant embedded inside a real-time code editor called Code Sync.
Multiple students are working together on the same coding problem. They have collaboratively written the following prompt and may have attached code snippets for context.

Your job:
1. Answer their question clearly and helpfully
2. If code is attached, reference it specifically in your response
3. If multiple code blocks are attached, compare/contrast them where relevant
4. Keep the response focused and educational
5. Format code in markdown with the correct language tag
6. If the prompt is about debugging, explain what went wrong before showing any fix`

function CoPromptContextProvider({ children }: { children: ReactNode }) {
    const { socket } = useSocket()
    const { currentUser } = useAppContext()
    const { activeFile } = useFileSystem()
    const { language } = useSettings()

    const [promptText, setPromptText] = useState("")
    const [linkedBlocks, setLinkedBlocks] = useState<LinkedCodeBlock[]>([])
    const [remoteCursors, setRemoteCursors] = useState<PromptCursor[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [aiResponse, setAiResponse] = useState("")
    const [history, setHistory] = useState<PromptHistoryEntry[]>([])

    // Debounce ref for cursor updates
    const cursorDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

    // ── Update prompt (local + broadcast) ─────────────────────────────────────
    const updatePrompt = useCallback(
        (text: string, cursorPos: number) => {
            setPromptText(text)
            socket.emit(SocketEvent.CO_PROMPT_UPDATE, { text })

            // Debounce cursor position broadcast
            if (cursorDebounce.current) clearTimeout(cursorDebounce.current)
            cursorDebounce.current = setTimeout(() => {
                socket.emit(SocketEvent.CO_PROMPT_CURSOR, {
                    username: currentUser.username,
                    position: cursorPos,
                    color: colorForUser(currentUser.username),
                })
            }, 80)
        },
        [socket, currentUser.username],
    )

    // ── Link current active file as a code block ───────────────────────────────
    const linkCurrentFile = useCallback(() => {
        if (!activeFile) {
            toast.error("No file is open to link")
            return
        }
        const block: LinkedCodeBlock = {
            id: uuidv4(),
            fileId: activeFile.id,
            fileName: activeFile.name,
            code: activeFile.content ?? "",
            language,
            linkedBy: currentUser.username,
            linkedAt: Date.now(),
        }
        setLinkedBlocks((prev) => {
            // Avoid duplicate file links
            if (prev.find((b) => b.fileId === activeFile.id)) {
                toast("This file is already linked", { icon: "ℹ️" })
                return prev
            }
            return [...prev, block]
        })
        socket.emit(SocketEvent.CO_PROMPT_LINK_CODE, { block })
        toast.success(`Linked "${activeFile.name}"`)
    }, [activeFile, currentUser.username, language, socket])

    // ── Unlink a code block ────────────────────────────────────────────────────
    const unlinkBlock = useCallback(
        (id: string) => {
            setLinkedBlocks((prev) => prev.filter((b) => b.id !== id))
            socket.emit(SocketEvent.CO_PROMPT_UNLINK_CODE, { id })
        },
        [socket],
    )

    // ── Submit prompt to AI ────────────────────────────────────────────────────
    const submitPrompt = useCallback(async () => {
        if (!promptText.trim()) {
            toast.error("Write a prompt first")
            return
        }
        setIsSubmitting(true)
        socket.emit(SocketEvent.CO_PROMPT_SUBMIT, {
            submittedBy: currentUser.username,
        })

        // Build the full message with linked code blocks
        let fullPrompt = promptText.trim()
        if (linkedBlocks.length > 0) {
            fullPrompt += "\n\n--- Attached Code ---\n"
            linkedBlocks.forEach((block) => {
                fullPrompt += `\nFile: ${block.fileName} (linked by ${block.linkedBy})\n\`\`\`${block.language}\n${block.code}\n\`\`\`\n`
            })
        }

        try {
            const response = await callAIProxy([
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: fullPrompt },
            ])

            setAiResponse(response)

            // Save to history
            const entry: PromptHistoryEntry = {
                id: uuidv4(),
                prompt: promptText,
                linkedBlocks: [...linkedBlocks],
                response,
                submittedBy: currentUser.username,
                timestamp: Date.now(),
            }
            setHistory((prev) => [entry, ...prev])

            // Broadcast response to all users in room
            socket.emit(SocketEvent.CO_PROMPT_RESPONSE, { response, entry })
        } catch (err: any) {
            console.error(err)
            const msg = err?.response?.data?.error ?? err?.message ?? "AI request failed"
            toast.error(msg.length > 80 ? "AI service temporarily unavailable. Try again." : msg)
        } finally {
            setIsSubmitting(false)
        }
    }, [promptText, linkedBlocks, currentUser.username, socket])

    // ── Clear prompt ───────────────────────────────────────────────────────────
    const clearPrompt = useCallback(() => {
        setPromptText("")
        setLinkedBlocks([])
        setAiResponse("")
        socket.emit(SocketEvent.CO_PROMPT_CLEAR)
    }, [socket])

    // ── Socket listeners ───────────────────────────────────────────────────────
    useEffect(() => {
        // Remote user updated the prompt text
        socket.on(SocketEvent.CO_PROMPT_UPDATE, ({ text }: { text: string }) => {
            setPromptText(text)
        })

        // Remote user moved cursor
        socket.on(SocketEvent.CO_PROMPT_CURSOR, (cursor: PromptCursor) => {
            setRemoteCursors((prev) => {
                const filtered = prev.filter((c) => c.username !== cursor.username)
                return [...filtered, cursor]
            })
            // Remove cursor after 3s of inactivity
            setTimeout(() => {
                setRemoteCursors((prev) =>
                    prev.filter((c) => c.username !== cursor.username),
                )
            }, 3000)
        })

        // Remote user linked a code block
        socket.on(SocketEvent.CO_PROMPT_LINK_CODE, ({ block }: { block: LinkedCodeBlock }) => {
            setLinkedBlocks((prev) => {
                if (prev.find((b) => b.id === block.id)) return prev
                return [...prev, block]
            })
            toast(`${block.linkedBy} linked "${block.fileName}"`, { icon: "🔗" })
        })

        // Remote user unlinked a code block
        socket.on(SocketEvent.CO_PROMPT_UNLINK_CODE, ({ id }: { id: string }) => {
            setLinkedBlocks((prev) => prev.filter((b) => b.id !== id))
        })

        // Someone submitted — show loading indicator
        socket.on(SocketEvent.CO_PROMPT_SUBMIT, ({ submittedBy }: { submittedBy: string }) => {
            setIsSubmitting(true)
            toast.loading(`${submittedBy} submitted the prompt…`, { id: "co-submit" })
        })

        // AI response received (from the submitter, broadcast to all)
        socket.on(
            SocketEvent.CO_PROMPT_RESPONSE,
            ({ response, entry }: { response: string; entry: PromptHistoryEntry }) => {
                setAiResponse(response)
                setIsSubmitting(false)
                setHistory((prev) => {
                    if (prev.find((e) => e.id === entry.id)) return prev
                    return [entry, ...prev]
                })
                toast.dismiss("co-submit")
            },
        )

        // Remote user cleared the prompt
        socket.on(SocketEvent.CO_PROMPT_CLEAR, () => {
            setPromptText("")
            setLinkedBlocks([])
            setAiResponse("")
        })

        return () => {
            socket.off(SocketEvent.CO_PROMPT_UPDATE)
            socket.off(SocketEvent.CO_PROMPT_CURSOR)
            socket.off(SocketEvent.CO_PROMPT_LINK_CODE)
            socket.off(SocketEvent.CO_PROMPT_UNLINK_CODE)
            socket.off(SocketEvent.CO_PROMPT_SUBMIT)
            socket.off(SocketEvent.CO_PROMPT_RESPONSE)
            socket.off(SocketEvent.CO_PROMPT_CLEAR)
        }
    }, [socket])

    return (
        <CoPromptContext.Provider
            value={{
                promptText,
                linkedBlocks,
                remoteCursors,
                isSubmitting,
                aiResponse,
                history,
                updatePrompt,
                linkCurrentFile,
                unlinkBlock,
                submitPrompt,
                clearPrompt,
            }}
        >
            {children}
        </CoPromptContext.Provider>
    )
}

export { CoPromptContextProvider }
export default CoPromptContext
