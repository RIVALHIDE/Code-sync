import { useCopilot } from "@/context/CopilotContext"
import { useFileSystem } from "@/context/FileContext"
import { useSocket } from "@/context/SocketContext"
import { SocketEvent } from "@/types/socket"
import { isValidElement, ReactNode, useId, useRef, useState } from "react"
import toast from "react-hot-toast"
import {
    LuArrowUpRight,
    LuCheckCheck,
    LuClipboardPaste,
    LuCode2,
    LuCopy,
    LuFileCode2,
    LuLoader2,
    LuRepeat,
    LuSparkles,
} from "react-icons/lu"
import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism"

const promptStarters = [
    {
        title: "Build a component",
        description: "Turn an idea into a starting point",
        prompt: "Create an accessible React search input component with a clear button, using TypeScript and Tailwind CSS.",
        icon: LuCode2,
    },
    {
        title: "Write a useful function",
        description: "Make the repetitive parts simpler",
        prompt: "Write a type-safe TypeScript debounce utility with a cancel method and a usage example.",
        icon: LuFileCode2,
    },
    {
        title: "Cover the edge cases",
        description: "Start with a thoughtful set of tests",
        prompt: "Write unit tests for an email validation function, covering valid addresses, empty input, and malformed addresses.",
        icon: LuCheckCheck,
    },
]

const outputActionClass =
    "inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-700/70 bg-slate-800/50 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-700/70 disabled:hover:bg-slate-800/50 disabled:hover:text-slate-300"

function CopilotView() {
    const { socket } = useSocket()
    const { generateCode, output, isRunning, setInput } = useCopilot()
    const { activeFile, updateFileContent, setActiveFile } = useFileSystem()
    const [prompt, setPrompt] = useState("")
    const promptRef = useRef<HTMLTextAreaElement>(null)
    const promptId = useId()
    const canGenerate = prompt.trim().length > 0 && !isRunning

    const updatePrompt = (value: string) => {
        setPrompt(value)
        setInput(value)
    }

    const copyOutput = async () => {
        try {
            const content = output.replace(/```[\w]*\n?/g, "").trim()
            await navigator.clipboard.writeText(content)
            toast.success("Output copied to clipboard")
        } catch (error) {
            toast.error("Unable to copy output to clipboard")
            console.log(error)
        }
    }

    const pasteCodeInFile = () => {
        if (activeFile) {
            const fileContent = activeFile.content
                ? `${activeFile.content}\n`
                : ""
            const content = `${fileContent}${output.replace(/```[\w]*\n?/g, "").trim()}`
            updateFileContent(activeFile.id, content)
            setActiveFile({ ...activeFile, content })
            toast.success("Code pasted successfully")
            socket.emit(SocketEvent.FILE_UPDATED, {
                fileId: activeFile.id,
                newContent: content,
            })
        }
    }

    const replaceCodeInFile = () => {
        if (activeFile) {
            const isConfirmed = confirm(
                "Are you sure you want to replace the code in the file?",
            )
            if (!isConfirmed) return
            const content = output.replace(/```[\w]*\n?/g, "").trim()
            updateFileContent(activeFile.id, content)
            setActiveFile({ ...activeFile, content })
            toast.success("Code replaced successfully")
            socket.emit(SocketEvent.FILE_UPDATED, {
                fileId: activeFile.id,
                newContent: content,
            })
        }
    }

    return (
        <section
            className="copilot-panel flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-slate-900/40 text-slate-200"
            aria-labelledby={`${promptId}-title`}
        >
            <header className="shrink-0 border-b border-slate-800 px-5 py-5">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
                    <LuSparkles size={13} aria-hidden="true" />
                    Your coding companion
                </div>
                <h1
                    id={`${promptId}-title`}
                    className="text-lg font-semibold tracking-tight text-slate-100"
                >
                    Copilot
                </h1>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    A little help for your next great idea.
                </p>
            </header>

            <div className="copilot-content flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
                {!output && !isRunning && (
                    <div className="flex flex-1 flex-col justify-center px-5 py-6">
                        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-400">
                            <LuCode2 size={20} aria-hidden="true" />
                        </div>
                        <h2 className="text-sm font-medium text-slate-100">
                            What are we building?
                        </h2>
                        <p className="mt-2 text-xs leading-5 text-slate-400">
                            Describe what you need, or pick a starting point and
                            make it your own.
                        </p>
                        <div className="mt-5 space-y-2">
                            {promptStarters.map((starter) => (
                                <button
                                    key={starter.title}
                                    type="button"
                                    title={`Use prompt: ${starter.title}`}
                                    onClick={() => {
                                        updatePrompt(starter.prompt)
                                        promptRef.current?.focus()
                                    }}
                                    className="group flex w-full items-center gap-3 rounded-lg border border-slate-700/60 bg-slate-800/30 p-3 text-left transition-colors hover:border-emerald-400/30 hover:bg-slate-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
                                >
                                    <starter.icon
                                        size={16}
                                        className="shrink-0 text-slate-400 transition-colors group-hover:text-emerald-400"
                                        aria-hidden="true"
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-xs font-medium text-slate-200">
                                            {starter.title}
                                        </span>
                                        <span className="mt-1 block text-[11px] leading-4 text-slate-500">
                                            {starter.description}
                                        </span>
                                    </span>
                                    <LuArrowUpRight
                                        size={13}
                                        className="shrink-0 text-slate-500 group-hover:text-emerald-400"
                                        aria-hidden="true"
                                    />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {isRunning && (
                    <div
                        role="status"
                        className="mx-4 my-4 flex items-center gap-3 rounded-lg border border-emerald-400/15 bg-emerald-400/5 p-3"
                    >
                        <LuLoader2
                            size={17}
                            className="shrink-0 animate-spin text-emerald-400 motion-reduce:animate-none"
                            aria-hidden="true"
                        />
                        <div>
                            <p className="text-xs font-medium text-slate-200">
                                Working on your code…
                            </p>
                            <p className="mt-1 text-[11px] text-slate-400">
                                This may take a moment.
                            </p>
                        </div>
                    </div>
                )}

                {output && (
                    <section
                        className="min-w-0 px-4 py-4"
                        aria-label="Generated code"
                    >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <h2 className="text-xs font-medium text-slate-200">
                                {isRunning
                                    ? "Previous result"
                                    : "Generated code"}
                            </h2>
                            <span className="text-[10px] text-slate-500">
                                Review before applying
                            </span>
                        </div>
                        <div className="mb-3 flex flex-wrap gap-1.5">
                            <button
                                type="button"
                                className={outputActionClass}
                                title="Copy output to clipboard"
                                onClick={copyOutput}
                            >
                                <LuCopy size={13} aria-hidden="true" />
                                Copy
                            </button>
                            <button
                                type="button"
                                className={outputActionClass}
                                title={
                                    activeFile
                                        ? `Append code to ${activeFile.name}`
                                        : "Open a file to append code"
                                }
                                onClick={pasteCodeInFile}
                                disabled={!activeFile || isRunning}
                            >
                                <LuClipboardPaste
                                    size={13}
                                    aria-hidden="true"
                                />
                                Append
                            </button>
                            <button
                                type="button"
                                className={outputActionClass}
                                title={
                                    activeFile
                                        ? `Replace code in ${activeFile.name}`
                                        : "Open a file to replace code"
                                }
                                onClick={replaceCodeInFile}
                                disabled={!activeFile || isRunning}
                            >
                                <LuRepeat size={13} aria-hidden="true" />
                                Replace
                            </button>
                        </div>
                        <p className="mb-4 flex min-w-0 items-center gap-1.5 text-[11px] text-slate-500">
                            <LuFileCode2
                                size={12}
                                className="shrink-0"
                                aria-hidden="true"
                            />
                            <span className="truncate" title={activeFile?.name}>
                                {activeFile
                                    ? `Active file: ${activeFile.name}`
                                    : "Open a file to apply generated code."}
                            </span>
                        </p>
                        <div className="copilot-output min-w-0 break-words text-xs leading-6 text-slate-300 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-600 [&_blockquote]:pl-3 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:font-medium [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5">
                            <ReactMarkdown
                                components={{
                                    a({ children, href, title }) {
                                        return (
                                            <a
                                                href={href}
                                                title={title}
                                                className="text-emerald-400 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                                            >
                                                {children}
                                            </a>
                                        )
                                    },
                                    code({ children, className }) {
                                        return (
                                            <code
                                                className={`rounded bg-slate-800 px-1 py-0.5 font-mono text-[11px] text-emerald-200 ${className || ""}`}
                                            >
                                                {children}
                                            </code>
                                        )
                                    },
                                    pre({ children }) {
                                        if (
                                            !isValidElement<{
                                                className?: string
                                                children?: ReactNode
                                            }>(children)
                                        ) {
                                            return (
                                                <pre className="overflow-x-auto">
                                                    {children}
                                                </pre>
                                            )
                                        }
                                        const language =
                                            /language-([\w-]+)/.exec(
                                                children.props.className || "",
                                            )?.[1] || "text"

                                        return (
                                            <div className="mb-3 overflow-hidden rounded-lg border border-slate-700/70">
                                                <div className="border-b border-slate-700/60 bg-slate-800/60 px-3 py-1 text-[10px] font-medium text-slate-400">
                                                    {language}
                                                </div>
                                                <SyntaxHighlighter
                                                    style={dracula}
                                                    language={language}
                                                    PreTag="div"
                                                    tabIndex={0}
                                                    aria-label={`${language} code`}
                                                    customStyle={{
                                                        margin: 0,
                                                        padding: "12px",
                                                        background: "#111b27",
                                                        borderRadius: 0,
                                                        fontSize: "11px",
                                                        lineHeight: "1.8",
                                                    }}
                                                    codeTagProps={{
                                                        style: {
                                                            fontFamily:
                                                                "monospace",
                                                        },
                                                    }}
                                                >
                                                    {String(
                                                        children.props.children,
                                                    ).replace(/\n$/, "")}
                                                </SyntaxHighlighter>
                                            </div>
                                        )
                                    },
                                }}
                            >
                                {output}
                            </ReactMarkdown>
                        </div>
                    </section>
                )}
            </div>

            <form
                className="copilot-composer shrink-0 border-t border-slate-800 bg-slate-900/50 p-4"
                onSubmit={(event) => {
                    event.preventDefault()
                    if (canGenerate) generateCode()
                }}
            >
                <div className="mb-2 flex items-center justify-between gap-2">
                    <label
                        htmlFor={promptId}
                        className="text-xs font-medium text-slate-300"
                    >
                        Your prompt
                    </label>
                    <span className="text-[10px] text-slate-500">
                        {prompt.length} characters
                    </span>
                </div>
                <div className="overflow-hidden rounded-lg border border-slate-700/80 bg-slate-950/40 transition-colors focus-within:border-emerald-400/50 focus-within:ring-1 focus-within:ring-emerald-400/20">
                    <textarea
                        ref={promptRef}
                        id={promptId}
                        rows={4}
                        value={prompt}
                        onChange={(event) => updatePrompt(event.target.value)}
                        onKeyDown={(event) => {
                            if (
                                event.key === "Enter" &&
                                (event.metaKey || event.ctrlKey) &&
                                !event.nativeEvent.isComposing
                            ) {
                                event.preventDefault()
                                if (canGenerate) generateCode()
                            }
                        }}
                        aria-describedby={`${promptId}-hint`}
                        placeholder="Describe the code you have in mind…"
                        className="block max-h-48 min-h-[96px] w-full resize-y border-none bg-transparent p-3 text-xs leading-5 text-slate-200 outline-none placeholder:text-slate-500"
                    />
                    <div
                        id={`${promptId}-hint`}
                        className="px-3 pb-2.5 text-[10px] text-slate-500"
                    >
                        Ctrl / ⌘ + Enter to generate
                    </div>
                </div>
                <button
                    type="submit"
                    title="Generate code from your prompt"
                    disabled={!canGenerate}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-500/90 px-3 py-2.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
                >
                    {isRunning ? (
                        <LuLoader2
                            size={14}
                            className="animate-spin motion-reduce:animate-none"
                            aria-hidden="true"
                        />
                    ) : (
                        <LuSparkles size={14} aria-hidden="true" />
                    )}
                    {isRunning ? "Generating…" : "Generate code"}
                </button>
                <p className="mt-2.5 text-center text-[10px] leading-4 text-slate-500">
                    AI can make mistakes. Always review your code.
                </p>
            </form>
        </section>
    )
}

export default CopilotView
