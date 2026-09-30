import { useCoPrompt } from "@/context/CoPromptContext"
import { useAppContext } from "@/context/AppContext"
import useResponsive from "@/hooks/useResponsive"
import { PromptHistoryEntry } from "@/types/coPrompt"
import { useState, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism"
import { LuLink, LuX, LuSend, LuTrash2, LuChevronDown, LuChevronUp, LuUsers } from "react-icons/lu"
import { PiMagicWand } from "react-icons/pi"

function formatAgo(ts: number): string {
    const s = Math.floor((Date.now() - ts) / 1000)
    if (s < 60) return "just now"
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    return `${Math.floor(s / 3600)}h ago`
}

function HistoryItem({ entry }: { entry: PromptHistoryEntry }) {
    const [expanded, setExpanded] = useState(false)

    return (
        <div className="flex flex-col gap-1 rounded-lg border border-white/10 bg-darkHover p-3">
            <div
                className="flex cursor-pointer items-center justify-between gap-2"
                onClick={() => setExpanded((v) => !v)}
            >
                <div className="flex flex-col gap-0.5 overflow-hidden">
                    <span className="truncate text-xs font-medium text-white/80">
                        {entry.prompt.slice(0, 60)}{entry.prompt.length > 60 ? "…" : ""}
                    </span>
                    <span className="text-xs text-white/30">
                        by {entry.submittedBy} · {formatAgo(entry.timestamp)}
                        {entry.linkedBlocks.length > 0 && ` · ${entry.linkedBlocks.length} file(s)`}
                    </span>
                </div>
                {expanded
                    ? <LuChevronUp size={14} className="shrink-0 text-white/40" />
                    : <LuChevronDown size={14} className="shrink-0 text-white/40" />
                }
            </div>
            {expanded && (
                <div className="mt-2 text-sm text-white/80">
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
                                    <code className="rounded bg-white/10 px-1 py-0.5 text-xs font-mono" {...props}>
                                        {children}
                                    </code>
                                )
                            },
                        }}
                    >
                        {entry.response}
                    </ReactMarkdown>
                </div>
            )}
        </div>
    )
}

function CoPromptView() {
    const { viewHeight } = useResponsive()
    const { currentUser } = useAppContext()
    const {
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
    } = useCoPrompt()

    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const responseRef = useRef<HTMLDivElement>(null)
    const [showHistory, setShowHistory] = useState(false)

    // Scroll response into view when it arrives
    useEffect(() => {
        if (aiResponse) {
            responseRef.current?.scrollIntoView({ behavior: "smooth" })
        }
    }, [aiResponse])

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        updatePrompt(e.target.value, e.target.selectionStart ?? 0)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            submitPrompt()
        }
    }

    return (
        <div
            className="flex flex-col gap-3 overflow-y-auto p-4"
            style={{ height: viewHeight }}
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <PiMagicWand size={18} className="text-primary" />
                    <h1 className="view-title mb-0">Co-Prompt AI</h1>
                </div>
                {remoteCursors.length > 0 && (
                    <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1">
                        <LuUsers size={12} className="text-primary" />
                        <span className="text-xs text-primary">
                            {remoteCursors.length} editing
                        </span>
                    </div>
                )}
            </div>

            {/* Live editing indicator */}
            {remoteCursors.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {remoteCursors.map((c) => (
                        <span
                            key={c.username}
                            className="rounded-full px-2 py-0.5 text-xs font-medium text-dark"
                            style={{ backgroundColor: c.color }}
                        >
                            {c.username}
                        </span>
                    ))}
                    <span className="text-xs text-white/30 self-center">editing…</span>
                </div>
            )}

            {/* Shared prompt textarea */}
            <div className="relative flex flex-col rounded-lg border border-primary/30 bg-darkHover focus-within:border-primary/60 transition-colors">
                <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
                    <span className="text-xs text-white/40">Shared prompt — everyone edits together</span>
                    <button
                        onClick={clearPrompt}
                        title="Clear prompt"
                        className="text-white/30 transition-colors hover:text-red-400"
                    >
                        <LuTrash2 size={13} />
                    </button>
                </div>
                <textarea
                    ref={textareaRef}
                    value={promptText}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Write your AI prompt here… everyone in the room sees and can edit this in real time.&#10;&#10;Tip: Link code files below to give the AI context. Press Ctrl+Enter to submit."
                    disabled={isSubmitting}
                    className="min-h-[120px] w-full resize-none bg-transparent p-3 text-sm text-white placeholder-white/25 outline-none disabled:opacity-50"
                />
                {/* Character count */}
                <div className="flex justify-end px-3 pb-1.5">
                    <span className="text-xs text-white/20">{promptText.length} chars</span>
                </div>
            </div>

            {/* Linked code blocks */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white/50">
                        Linked files ({linkedBlocks.length})
                    </span>
                    <button
                        onClick={linkCurrentFile}
                        className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                    >
                        <LuLink size={11} />
                        Link active file
                    </button>
                </div>

                {linkedBlocks.length === 0 && (
                    <p className="text-xs text-white/25 italic">
                        No files linked yet. Click "Link active file" to attach code context.
                    </p>
                )}

                {linkedBlocks.map((block) => (
                    <div
                        key={block.id}
                        className="flex items-start gap-2 rounded-lg border border-white/10 bg-darkHover p-2"
                    >
                        <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                            <div className="flex items-center gap-2">
                                <span className="truncate text-xs font-semibold text-white">
                                    {block.fileName}
                                </span>
                                <span className="rounded bg-primary/10 px-1 text-xs text-primary">
                                    {block.language}
                                </span>
                            </div>
                            <span className="text-xs text-white/30">
                                linked by {block.linkedBy}
                                {block.linkedBy === currentUser.username ? " (you)" : ""}
                            </span>
                            <pre className="mt-1 max-h-[60px] overflow-hidden text-ellipsis rounded bg-dark p-1 text-xs text-white/50">
                                {block.code.slice(0, 150)}{block.code.length > 150 ? "…" : ""}
                            </pre>
                        </div>
                        <button
                            onClick={() => unlinkBlock(block.id)}
                            title="Unlink"
                            className="mt-0.5 shrink-0 text-white/30 transition-colors hover:text-red-400"
                        >
                            <LuX size={14} />
                        </button>
                    </div>
                ))}
            </div>

            {/* Submit button */}
            <button
                onClick={submitPrompt}
                disabled={isSubmitting || !promptText.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-dark transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
                {isSubmitting ? (
                    <>
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-dark border-t-transparent" />
                        Thinking…
                    </>
                ) : (
                    <>
                        <LuSend size={15} />
                        Submit to AI
                        <span className="ml-1 text-xs opacity-60">(Ctrl+Enter)</span>
                    </>
                )}
            </button>

            {/* AI Response */}
            {aiResponse && (
                <div ref={responseRef} className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-dark p-3">
                    <div className="flex items-center gap-2">
                        <PiMagicWand size={14} className="text-primary" />
                        <span className="text-xs font-semibold text-primary">AI Response</span>
                        <span className="ml-auto text-xs text-white/30">(shared with room)</span>
                    </div>
                    <div className="text-sm text-white/85">
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
                                        <code className="rounded bg-white/10 px-1 py-0.5 text-xs font-mono" {...props}>
                                            {children}
                                        </code>
                                    )
                                },
                            }}
                        >
                            {aiResponse}
                        </ReactMarkdown>
                    </div>
                </div>
            )}

            {/* History toggle */}
            {history.length > 0 && (
                <div className="flex flex-col gap-2">
                    <button
                        onClick={() => setShowHistory((v) => !v)}
                        className="flex items-center gap-2 text-xs text-white/40 hover:text-white/60 transition-colors"
                    >
                        {showHistory ? <LuChevronUp size={13} /> : <LuChevronDown size={13} />}
                        Prompt history ({history.length})
                    </button>
                    {showHistory && (
                        <div className="flex flex-col gap-2">
                            {history.map((entry) => (
                                <HistoryItem key={entry.id} entry={entry} />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default CoPromptView
