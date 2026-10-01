import { callAIProxy } from "@/api/aiApi"
import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useRef,
    useState,
} from "react"
import toast from "react-hot-toast"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HintMessage {
    role: "assistant" | "user"
    content: string
}

export interface MentorSelection {
    code: string
    language: string
    fileId: string
    truncated?: boolean
}

export const MENTOR_SELECTION_LIMIT = 12000

interface PedagogicalAIContextType {
    hints: HintMessage[]
    isThinking: boolean
    currentError: string
    analyzeError: (errorOutput: string, code: string, language: string) => Promise<void>
    askFollowUp: (question: string) => Promise<void>
    requestNextHint: () => Promise<void>
    clearHints: () => void
    hasError: boolean
    mentorMessages: HintMessage[]
    mentorSelection: MentorSelection | null
    mentorError: string
    isMentorThinking: boolean
    askMentor: (question: string, selection: MentorSelection) => Promise<void>
    clearMentor: () => void
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SOCRATIC_SYSTEM_PROMPT = `You are a Socratic programming tutor embedded in a collaborative code editor used by students learning to code.

Your job is to help students understand their errors through guided discovery — NOT by giving them the answer directly.

STRICT RULES you must NEVER break:
1. NEVER provide the corrected code or the fix directly.
2. NEVER say "here is the solution" or "the fix is...".
3. NEVER rewrite the student's code for them.
4. ALWAYS respond with questions, hints, and explanations that guide the student to find the answer themselves.
5. Keep each response SHORT — 2 to 4 sentences maximum.
6. Use plain English. Avoid jargon unless you explain it immediately after.
7. If the student asks you to "just give the answer", gently refuse and give a stronger hint instead.
8. Progress hints from vague to specific across multiple turns. First hint: very general concept. Second hint: point to the exact line. Third hint: explain what is wrong without fixing it.

RESPONSE FORMAT:
- Start with a short empathetic acknowledgement (1 sentence max).
- Then ask 1-2 guiding questions or give a conceptual hint.
- End with an encouraging line like "What do you think might be wrong there?" or "Can you spot what's different from what the language expects?"

Remember: your goal is to build understanding, not to fix code.`

const RUBBER_DUCK_SYSTEM_PROMPT = `You are a patient rubber-duck programming mentor embedded in a collaborative code editor.

Help the student reason about the code they selected and answer their natural-language question. Keep the explanation focused on the selected snippet, describe what the code currently does, and point out useful things to inspect without pretending you ran it. Do not mention compilers, Piston, or execution results unless the student provides them. Use plain English and keep the response to 3-6 short sentences. If the selection is not enough to answer confidently, say what context is missing and ask one useful follow-up question.`

// ─── Context ──────────────────────────────────────────────────────────────────

const PedagogicalAIContext = createContext<PedagogicalAIContextType | null>(null)

export const usePedagogicalAI = (): PedagogicalAIContextType => {
    const context = useContext(PedagogicalAIContext)
    if (!context) {
        throw new Error("usePedagogicalAI must be used within PedagogicalAIContextProvider")
    }
    return context
}

// ─── Provider ─────────────────────────────────────────────────────────────────

function PedagogicalAIContextProvider({ children }: { children: ReactNode }) {
    const [hints, setHints] = useState<HintMessage[]>([])
    const [isThinking, setIsThinking] = useState(false)
    const [currentError, setCurrentError] = useState("")
    // Full conversation history for multi-turn context
    const [conversationHistory, setConversationHistory] = useState<
        Array<{ role: string; content: string }>
    >([])
    const [mentorMessages, setMentorMessages] = useState<HintMessage[]>([])
    const [mentorSelection, setMentorSelection] = useState<MentorSelection | null>(
        null,
    )
    const [mentorError, setMentorError] = useState("")
    const [isMentorThinking, setIsMentorThinking] = useState(false)
    const mentorRequestId = useRef(0)

    const hasError = currentError.length > 0

    const callAI = useCallback(
        async (messages: Array<{ role: string; content: string }>): Promise<string> => {
            return await callAIProxy([
                { role: "system", content: SOCRATIC_SYSTEM_PROMPT },
                ...messages,
            ])
        },
        [],
    )

    const askMentor = useCallback(
        async (question: string, selection: MentorSelection) => {
            const trimmedQuestion = question.trim()
            const selectedCode = selection.code.trim()

            if (!trimmedQuestion) {
                setMentorError("Ask a question about the selected code first.")
                return
            }
            if (!selectedCode) {
                setMentorError("Select a non-empty block of code before asking the mentor.")
                return
            }

            const boundedSelection: MentorSelection = {
                ...selection,
                code: selection.code.slice(0, MENTOR_SELECTION_LIMIT),
                truncated:
                    selection.truncated ||
                    selection.code.length > MENTOR_SELECTION_LIMIT,
            }
            const requestId = mentorRequestId.current + 1
            mentorRequestId.current = requestId
            setMentorSelection(boundedSelection)
            setMentorMessages([{ role: "user", content: trimmedQuestion }])
            setMentorError("")
            setIsMentorThinking(true)

            const userMessage = `The student selected this ${boundedSelection.language} code${
                boundedSelection.truncated ? " (the selection was shortened for context)" : ""
            }:

\`\`\`${boundedSelection.language}
${boundedSelection.code}
\`\`\`

Their question is: ${trimmedQuestion}`

            try {
                const reply = await callAIProxy([
                    { role: "system", content: RUBBER_DUCK_SYSTEM_PROMPT },
                    { role: "user", content: userMessage },
                ])
                if (mentorRequestId.current !== requestId) return
                setMentorMessages((previous) => [
                    ...previous,
                    { role: "assistant", content: reply },
                ])
            } catch (err) {
                if (mentorRequestId.current !== requestId) return
                console.error("Rubber-duck mentor error:", err)
                setMentorError(
                    "The mentor could not respond right now. Check your connection and try again.",
                )
            } finally {
                if (mentorRequestId.current === requestId) {
                    setIsMentorThinking(false)
                }
            }
        },
        [],
    )

    const clearMentor = useCallback(() => {
        mentorRequestId.current += 1
        setMentorMessages([])
        setMentorSelection(null)
        setMentorError("")
        setIsMentorThinking(false)
    }, [])

    const analyzeError = useCallback(
        async (errorOutput: string, code: string, language: string) => {
            if (!errorOutput.trim()) return

            setCurrentError(errorOutput)
            setHints([])
            setIsThinking(true)

            const userMessage = `I ran my ${language} code and got this error:

\`\`\`
${errorOutput}
\`\`\`

Here is my code:

\`\`\`${language}
${code}
\`\`\`

Can you help me understand what went wrong?`

            const initialHistory = [{ role: "user", content: userMessage }]
            setConversationHistory(initialHistory)

            try {
                const reply = await callAI(initialHistory)
                const assistantMsg: HintMessage = { role: "assistant", content: reply }
                setHints([assistantMsg])
                setConversationHistory([
                    ...initialHistory,
                    { role: "assistant", content: reply },
                ])
            } catch (err) {
                console.error("PedagogicalAI error:", err)
                toast.error("Failed to get hint from AI. Please try again.")
            } finally {
                setIsThinking(false)
            }
        },
        [callAI],
    )

    const askFollowUp = useCallback(
        async (question: string) => {
            if (!question.trim() || isThinking) return
            setIsThinking(true)

            const userMsg: HintMessage = { role: "user", content: question }
            setHints((prev) => [...prev, userMsg])

            const updatedHistory = [
                ...conversationHistory,
                { role: "user", content: question },
            ]
            setConversationHistory(updatedHistory)

            try {
                const reply = await callAI(updatedHistory)
                const assistantMsg: HintMessage = { role: "assistant", content: reply }
                setHints((prev) => [...prev, assistantMsg])
                setConversationHistory([
                    ...updatedHistory,
                    { role: "assistant", content: reply },
                ])
            } catch (err) {
                console.error("PedagogicalAI error:", err)
                toast.error("Failed to get hint from AI. Please try again.")
            } finally {
                setIsThinking(false)
            }
        },
        [callAI, conversationHistory, isThinking],
    )

    const requestNextHint = useCallback(async () => {
        await askFollowUp("Can you give me another hint? I'm still stuck.")
    }, [askFollowUp])

    const clearHints = useCallback(() => {
        setHints([])
        setCurrentError("")
        setConversationHistory([])
    }, [])

    return (
        <PedagogicalAIContext.Provider
            value={{
                hints,
                isThinking,
                currentError,
                analyzeError,
                askFollowUp,
                requestNextHint,
                clearHints,
                hasError,
                mentorMessages,
                mentorSelection,
                mentorError,
                isMentorThinking,
                askMentor,
                clearMentor,
            }}
        >
            {children}
        </PedagogicalAIContext.Provider>
    )
}

export { PedagogicalAIContextProvider }
export default PedagogicalAIContext
