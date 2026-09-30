import { callAIProxy } from "@/api/aiApi"
import { createContext, ReactNode, useCallback, useContext, useState } from "react"
import toast from "react-hot-toast"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HintMessage {
    role: "assistant" | "user"
    content: string
}

interface PedagogicalAIContextType {
    hints: HintMessage[]
    isThinking: boolean
    currentError: string
    analyzeError: (errorOutput: string, code: string, language: string) => Promise<void>
    askFollowUp: (question: string) => Promise<void>
    requestNextHint: () => Promise<void>
    clearHints: () => void
    hasError: boolean
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
            }}
        >
            {children}
        </PedagogicalAIContext.Provider>
    )
}

export { PedagogicalAIContextProvider }
export default PedagogicalAIContext
