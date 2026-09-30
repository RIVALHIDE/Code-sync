import { usePedagogicalAI } from "@/context/PedagogicalAIContext"
import { useRef, useState, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism"
import { LuBrain, LuSend, LuX, LuLightbulb } from "react-icons/lu"
import { PiStudent } from "react-icons/pi"

function HintPanel() {
    const {
        hints,
        isThinking,
        clearHints,
        askFollowUp,
        requestNextHint,
    } = usePedagogicalAI()

    const [followUp, setFollowUp] = useState("")
    const bottomRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom on new hints
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [hints, isThinking])

    const handleSend = () => {
        if (!followUp.trim()) return
        askFollowUp(followUp)
        setFollowUp("")
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <div className="flex flex-col rounded-lg border border-primary/30 bg-darkHover overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                <div className="flex items-center gap-2">
                    <PiStudent size={18} className="text-primary" />
                    <span className="text-sm font-semibold text-primary">
                        Pedagogical AI Tutor
                    </span>
                </div>
                <button
                    onClick={clearHints}
                    title="Close tutor"
                    className="text-white/40 transition-colors hover:text-white"
                >
                    <LuX size={16} />
                </button>
            </div>

            {/* Disclaimer */}
            <div className="flex items-start gap-2 border-b border-white/10 bg-primary/5 px-3 py-2">
                <LuLightbulb size={14} className="mt-0.5 shrink-0 text-yellow-400" />
                <p className="text-xs text-white/50">
                    I'll guide you to find the answer yourself — I won't give it away directly.
                </p>
            </div>

            {/* Hint thread */}
            <div className="flex max-h-[320px] flex-col gap-3 overflow-y-auto p-3">
                {hints.map((msg, i) => (
                    <div
                        key={i}
                        className={`flex gap-2 ${
                            msg.role === "user" ? "flex-row-reverse" : "flex-row"
                        }`}
                    >
                        {/* Avatar */}
                        <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                msg.role === "assistant"
                                    ? "bg-primary/20 text-primary"
                                    : "bg-white/10 text-white"
                            }`}
                        >
                            {msg.role === "assistant" ? (
                                <LuBrain size={14} />
                            ) : (
                                "You"
                            )}
                        </div>

                        {/* Bubble */}
                        <div
                            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                                msg.role === "assistant"
                                    ? "bg-dark text-white/90"
                                    : "bg-primary/20 text-white"
                            }`}
                        >
                            {msg.role === "assistant" ? (
                                <ReactMarkdown
                                    components={{
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        code({ inline, className, children, ...props }: any) {
                                            const match = /language-(\w+)/.exec(className || "")
                                            return !inline ? (
                                                <SyntaxHighlighter
                                                    style={dracula}
                                                    language={match ? match[1] : "text"}
                                                    PreTag="pre"
                                                    className="!my-1 !rounded-md !text-xs"
                                                >
                                                    {String(children).replace(/\n$/, "")}
                                                </SyntaxHighlighter>
                                            ) : (
                                                <code
                                                    className="rounded bg-white/10 px-1 py-0.5 text-xs font-mono"
                                                    {...props}
                                                >
                                                    {children}
                                                </code>
                                            )
                                        },
                                    }}
                                >
                                    {msg.content}
                                </ReactMarkdown>
                            ) : (
                                <span>{msg.content}</span>
                            )}
                        </div>
                    </div>
                ))}

                {/* Thinking indicator */}
                {isThinking && (
                    <div className="flex gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                            <LuBrain size={14} />
                        </div>
                        <div className="flex items-center gap-1 rounded-lg bg-dark px-3 py-2">
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:0ms]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:150ms]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:300ms]" />
                        </div>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 border-t border-white/10 px-3 py-2">
                <button
                    onClick={requestNextHint}
                    disabled={isThinking}
                    className="flex-1 rounded-md bg-primary/10 px-2 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Another hint
                </button>
            </div>

            {/* Follow-up input */}
            <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2">
                <input
                    type="text"
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isThinking}
                    placeholder="Ask a question..."
                    className="flex-1 rounded-md bg-dark px-3 py-1.5 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
                />
                <button
                    onClick={handleSend}
                    disabled={isThinking || !followUp.trim()}
                    className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-dark transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <LuSend size={14} />
                </button>
            </div>
        </div>
    )
}

export default HintPanel
