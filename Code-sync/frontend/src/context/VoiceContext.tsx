import { useFileSystem } from "@/context/FileContext"
import { useSocket } from "@/context/SocketContext"
import { SocketEvent } from "@/types/socket"
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

// ── Types ──────────────────────────────────────────────────────────────────────

export type RecognitionStatus = "idle" | "listening" | "processing" | "error"

export interface TranscriptEntry {
    id: string
    text: string
    type: "dictation" | "command" | "error"
    timestamp: number
}

export interface VoiceContextType {
    status: RecognitionStatus
    isSupported: boolean
    transcript: TranscriptEntry[]
    interimText: string
    continuous: boolean
    setContinuous: (v: boolean) => void
    startListening: () => void
    stopListening: () => void
    clearTranscript: () => void
}

// ── Web Speech API browser type augmentation ──────────────────────────────────
// These types are not in lib.dom.d.ts by default — define them here.

interface SpeechRecognitionResult {
    readonly isFinal: boolean
    readonly length: number
    item(index: number): SpeechRecognitionAlternative
    [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
    readonly transcript: string
    readonly confidence: number
}

interface SpeechRecognitionResultList {
    readonly length: number
    item(index: number): SpeechRecognitionResult
    [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number
    readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string
    readonly message: string
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean
    interimResults: boolean
    lang: string
    maxAlternatives: number
    onstart: ((this: SpeechRecognition, ev: Event) => void) | null
    onend: ((this: SpeechRecognition, ev: Event) => void) | null
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null
    start(): void
    stop(): void
    abort(): void
}

declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognition
        webkitSpeechRecognition: new () => SpeechRecognition
    }
}

// ── Voice command patterns ─────────────────────────────────────────────────────
// Each entry: [regex, handler label] — matched against lowercase transcript

// ── Symbol map: spoken word → inserted character ──────────────────────────────
// Used for both single and repeated spoken tokens e.g. "semicolon semicolon"
const SYMBOL_MAP: Record<string, string> = {
    // brackets / braces
    "open paren": "(",
    "left paren": "(",
    "open parenthesis": "(",
    "left parenthesis": "(",
    "close paren": ")",
    "right paren": ")",
    "close parenthesis": ")",
    "right parenthesis": ")",
    "open bracket": "[",
    "left bracket": "[",
    "close bracket": "]",
    "right bracket": "]",
    "open brace": "{",
    "left brace": "{",
    "open curly": "{",
    "left curly": "{",
    "close brace": "}",
    "right brace": "}",
    "close curly": "}",
    "right curly": "}",
    "open angle": "<",
    "close angle": ">",
    // punctuation
    "semicolon": ";",
    "colon": ":",
    "comma": ",",
    "dot": ".",
    "period": ".",
    "full stop": ".",
    "exclamation": "!",
    "exclamation mark": "!",
    "bang": "!",
    "question mark": "?",
    "at": "@",
    "at sign": "@",
    "hash": "#",
    "hashtag": "#",
    "pound": "#",
    "number sign": "#",
    "underscore": "_",
    "under score": "_",
    "dash": "-",
    "hyphen": "-",
    "minus": "-",
    "plus": "+",
    "plus sign": "+",
    "star": "*",
    "asterisk": "*",
    "slash": "/",
    "forward slash": "/",
    "back slash": "\\",
    "backward slash": "\\",
    "pipe": "|",
    "vertical bar": "|",
    "ampersand": "&",
    "and sign": "&",
    "percent": "%",
    "caret": "^",
    "tilde": "~",
    "backtick": "`",
    // quotes
    "quote": '"',
    "single quote": "'",
    "double quote": '"',
    // operators
    "equals": "=",
    "equals sign": "=",
    "double equals": "==",
    "triple equals": "===",
    "arrow": "=>",
    "fat arrow": "=>",
    "thin arrow": "->",
    "greater than": ">",
    "less than": "<",
    // whitespace
    "space": " ",
    "tab": "    ",
    "new line": "\n",
    "next line": "\n",
    "newline": "\n",
    "blank line": "\n\n",
    "empty line": "\n\n",
}

// Build a regex that matches one or more repetitions of any symbol token
// e.g. "semicolon semicolon" → inserts ";;"
// Sorted longest-first so multi-word tokens match before single words
const SYMBOL_KEYS_SORTED = Object.keys(SYMBOL_MAP).sort((a, b) => b.length - a.length)
const SYMBOL_TOKEN_RE = new RegExp(
    `^((?:${SYMBOL_KEYS_SORTED.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?:\\s+(?:${SYMBOL_KEYS_SORTED.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}))*)$`
)

const COMMAND_PATTERNS: Array<{
    pattern: RegExp
    label: string
    handler: (
        match: RegExpMatchArray,
        ctx: CommandHandlerContext,
    ) => void
}> = [
    // ── Navigation ────────────────────────────────────────────────────────────
    {
        // "next line" / "new line" / "go to new line" — with auto-indent
        pattern: /^(next line|new line|newline|go to new line|open new line)$/,
        label: "next line",
        handler: (_, { transformContent }) =>
            transformContent((text, pos) => {
                const indent = getCurrentIndent(text, pos)
                const newContent = text.slice(0, pos) + "\n" + indent + text.slice(pos)
                return { text: newContent, pos: pos + 1 + indent.length }
            }),
    },
    {
        pattern: /^(go to|move to) (beginning|start) of line$/,
        label: "beginning of line",
        handler: (_, { transformContent }) =>
            transformContent((text, pos) => ({ text, pos: findLineStart(text, pos) })),
    },
    {
        pattern: /^(go to|move to) end of line$/,
        label: "end of line",
        handler: (_, { transformContent }) =>
            transformContent((text, pos) => ({ text, pos: findLineEnd(text, pos) })),
    },

    // ── Deletion ──────────────────────────────────────────────────────────────
    {
        pattern: /^delete (last |previous )?word$/,
        label: "delete word",
        handler: (_, { transformContent }) =>
            transformContent((text, pos) => deleteLastWord(text, pos)),
    },
    {
        pattern: /^delete (last |previous )?line$/,
        label: "delete line",
        handler: (_, { transformContent }) =>
            transformContent((text, pos) => deleteCurrentLine(text, pos)),
    },
    {
        pattern: /^(clear|delete) (all|everything)$/,
        label: "clear all",
        handler: (_, { setContent }) => setContent(""),
    },
    {
        pattern: /^(undo|undo that)$/,
        label: "undo",
        handler: () => {
            document.execCommand?.("undo")
        },
    },

    // ── Indentation ───────────────────────────────────────────────────────────
    {
        pattern: /^(indent|add indent)$/,
        label: "indent",
        handler: (_, { insertAtCursor }) => insertAtCursor("    "),
    },
    {
        pattern: /^(dedent|unindent|remove indent)$/,
        label: "dedent",
        handler: (_, { transformContent }) =>
            transformContent((text, pos) => removeIndent(text, pos)),
    },

    // ── Open block: insert { then newline with extra indent ───────────────────
    {
        pattern: /^open block$/,
        label: "open block",
        handler: (_, { transformContent }) =>
            transformContent((text, pos) => {
                const indent = getCurrentIndent(text, pos)
                const insert = " {\n" + indent + "    "
                return { text: text.slice(0, pos) + insert + text.slice(pos), pos: pos + insert.length }
            }),
    },
    {
        pattern: /^close block$/,
        label: "close block",
        handler: (_, { transformContent }) =>
            transformContent((text, pos) => {
                const indent = getCurrentIndent(text, pos)
                // Dedent by one level then close
                const dedented = indent.length >= 4 ? indent.slice(4) : ""
                const insert = "\n" + dedented + "}"
                return { text: text.slice(0, pos) + insert + text.slice(pos), pos: pos + insert.length }
            }),
    },
]

interface CommandHandlerContext {
    insertAtCursor: (text: string) => void
    setContent: (text: string) => void
    transformContent: (
        fn: (text: string, cursorPos: number) => { text: string; pos: number },
    ) => void
}

// ── Cursor position helpers ────────────────────────────────────────────────────

/** Returns the leading whitespace of the line the cursor is on */
function getCurrentIndent(text: string, pos: number): string {
    const lineStart = findLineStart(text, pos)
    let i = lineStart
    while (i < text.length && (text[i] === " " || text[i] === "\t")) i++
    return text.slice(lineStart, i)
}

function findLineStart(text: string, pos: number): number {
    let i = Math.min(pos, text.length) - 1
    while (i >= 0 && text[i] !== "\n") i--
    return i + 1
}

function findLineEnd(text: string, pos: number): number {
    let i = Math.min(pos, text.length)
    while (i < text.length && text[i] !== "\n") i++
    return i
}

function deleteLastWord(text: string, pos: number): { text: string; pos: number } {
    if (pos === 0) return { text, pos }
    let i = pos - 1
    // Skip trailing whitespace
    while (i > 0 && /\s/.test(text[i])) i--
    // Delete back to next whitespace
    while (i > 0 && !/\s/.test(text[i - 1])) i--
    return { text: text.slice(0, i) + text.slice(pos), pos: i }
}

function deleteCurrentLine(text: string, pos: number): { text: string; pos: number } {
    const start = findLineStart(text, pos)
    let end = findLineEnd(text, pos)
    // Also consume the trailing newline
    if (end < text.length) end++
    return { text: text.slice(0, start) + text.slice(end), pos: start }
}

function removeIndent(text: string, pos: number): { text: string; pos: number } {
    const start = findLineStart(text, pos)
    const lineText = text.slice(start)
    if (lineText.startsWith("    ")) {
        return {
            text: text.slice(0, start) + lineText.slice(4),
            pos: Math.max(start, pos - 4),
        }
    } else if (lineText.startsWith("\t")) {
        return {
            text: text.slice(0, start) + lineText.slice(1),
            pos: Math.max(start, pos - 1),
        }
    }
    return { text, pos }
}

// ── Context ────────────────────────────────────────────────────────────────────

const VoiceContext = createContext<VoiceContextType | null>(null)

export const useVoice = (): VoiceContextType => {
    const ctx = useContext(VoiceContext)
    if (!ctx) throw new Error("useVoice must be used within VoiceContextProvider")
    return ctx
}

function VoiceContextProvider({ children }: { children: ReactNode }) {
    const { activeFile, setActiveFile } = useFileSystem()
    const { socket } = useSocket()

    const [status, setStatus] = useState<RecognitionStatus>("idle")
    const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
    const [interimText, setInterimText] = useState("")
    const [continuous, setContinuous] = useState(true)

    const recognitionRef = useRef<SpeechRecognition | null>(null)
    const cursorPosRef = useRef<number>(0)
    const activeFileRef = useRef(activeFile)

    // Keep ref in sync so recognition handlers always see latest file
    useEffect(() => {
        activeFileRef.current = activeFile
        if (activeFile?.content !== undefined) {
            cursorPosRef.current = activeFile.content.length
        }
    }, [activeFile])

    const isSupported =
        typeof window !== "undefined" &&
        ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)

    // ── Editor helpers ─────────────────────────────────────────────────────────

    const applyContentChange = useCallback(
        (newContent: string) => {
            const file = activeFileRef.current
            if (!file) {
                toast.error("No file is open")
                return
            }
            const updated = { ...file, content: newContent }
            setActiveFile(updated)
            socket.emit(SocketEvent.FILE_UPDATED, {
                fileId: file.id,
                newContent,
            })
        },
        [setActiveFile, socket],
    )

    const insertAtCursor = useCallback(
        (text: string) => {
            const file = activeFileRef.current
            if (!file) { toast.error("No file is open"); return }
            const content = file.content ?? ""
            const pos = Math.min(cursorPosRef.current, content.length)
            const newContent = content.slice(0, pos) + text + content.slice(pos)
            cursorPosRef.current = pos + text.length
            applyContentChange(newContent)
        },
        [applyContentChange],
    )

    const setContent = useCallback(
        (text: string) => {
            cursorPosRef.current = text.length
            applyContentChange(text)
        },
        [applyContentChange],
    )

    const transformContent = useCallback(
        (fn: (text: string, pos: number) => { text: string; pos: number }) => {
            const file = activeFileRef.current
            if (!file) { toast.error("No file is open"); return }
            const { text, pos } = fn(file.content ?? "", cursorPosRef.current)
            cursorPosRef.current = pos
            applyContentChange(text)
        },
        [applyContentChange],
    )

    const handlerCtx: CommandHandlerContext = {
        insertAtCursor,
        setContent,
        transformContent,
    }

    // ── Transcript helpers ─────────────────────────────────────────────────────

    const addEntry = useCallback(
        (text: string, type: TranscriptEntry["type"]) => {
            setTranscript((prev) => [
                {
                    id: crypto.randomUUID(),
                    text,
                    type,
                    timestamp: Date.now(),
                },
                ...prev.slice(0, 49), // keep last 50 entries
            ])
        },
        [],
    )

    // ── Command / dictation routing ────────────────────────────────────────────

    const processTranscript = useCallback(
        (raw: string) => {
            const lower = raw.trim().toLowerCase()

            // 1. Try named commands first (navigation, deletion, indent, block)
            for (const { pattern, label, handler } of COMMAND_PATTERNS) {
                const match = lower.match(pattern)
                if (match) {
                    addEntry(`⌘ ${label}`, "command")
                    handler(match, handlerCtx)
                    return
                }
            }

            // 2. Try to match one or more repeated symbol tokens
            //    e.g. "semicolon" → ";"  |  "semicolon semicolon" → ";;"
            //         "dot dot dot" → "..."  |  "next line next line" → "\n\n"
            const symbolMatch = lower.match(SYMBOL_TOKEN_RE)
            if (symbolMatch) {
                // Greedily split the matched string into individual symbol tokens
                let remaining = lower
                let result = ""
                while (remaining.length > 0) {
                    let matched = false
                    for (const key of SYMBOL_KEYS_SORTED) {
                        if (remaining === key || remaining.startsWith(key + " ")) {
                            result += SYMBOL_MAP[key]
                            remaining = remaining.slice(key.length).trimStart()
                            matched = true
                            break
                        }
                    }
                    if (!matched) break
                }
                if (result) {
                    addEntry(`⌘ "${result}"`, "command")
                    insertAtCursor(result)
                    return
                }
            }

            // 3. No command matched — treat as dictation, insert as-is with trailing space
            const textToInsert = raw.trim() + " "
            addEntry(raw.trim(), "dictation")
            insertAtCursor(textToInsert)
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [addEntry, insertAtCursor],
    )

    // ── Speech Recognition lifecycle ───────────────────────────────────────────

    const startListening = useCallback(() => {
        if (!isSupported) {
            toast.error("Speech recognition is not supported in this browser. Try Chrome.")
            return
        }
        if (recognitionRef.current) return // already running

        const SpeechRecognitionClass =
            window.SpeechRecognition ?? window.webkitSpeechRecognition
        const recognition = new SpeechRecognitionClass()

        recognition.continuous = continuous
        recognition.interimResults = true
        recognition.lang = "en-US"
        recognition.maxAlternatives = 1

        recognition.onstart = () => {
            setStatus("listening")
            setInterimText("")
        }

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let interim = ""
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i]
                if (result.isFinal) {
                    const finalText = result[0].transcript
                    setInterimText("")
                    setStatus("processing")
                    processTranscript(finalText)
                    setStatus("listening")
                } else {
                    interim += result[0].transcript
                }
            }
            setInterimText(interim)
        }

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            // "no-speech" is not a real error — just silence
            if (event.error === "no-speech") return
            console.error("Speech recognition error:", event.error)
            setStatus("error")
            // For fatal errors, clear the ref BEFORE onend fires so it won't restart
            if (event.error === "not-allowed" || event.error === "network") {
                recognitionRef.current = null
            }
            if (event.error === "network") {
                addEntry("Error: network — Google's speech servers are blocked. Use Chrome or disable Brave Shields.", "error")
                toast.error("Speech API blocked. Use Chrome for Voice-to-Code.", { duration: 6000 })
            } else if (event.error === "not-allowed") {
                addEntry("Error: microphone permission denied", "error")
                toast.error(
                    "Microphone access denied. Click the 🔒 icon in the address bar and allow microphone, then refresh.",
                    { duration: 8000 },
                )
            } else {
                addEntry(`Error: ${event.error}`, "error")
            }
        }

        recognition.onend = () => {
            setInterimText("")
            // If continuous mode, restart automatically unless user stopped
            if (recognitionRef.current && continuous) {
                try {
                    recognition.start()
                } catch {
                    // Already started — ignore
                }
            } else {
                recognitionRef.current = null
                setStatus("idle")
            }
        }

        recognitionRef.current = recognition
        try {
            recognition.start()
        } catch (err) {
            console.error("Failed to start recognition:", err)
            setStatus("error")
            recognitionRef.current = null
        }
    }, [isSupported, continuous, processTranscript, addEntry])

    const stopListening = useCallback(() => {
        if (!recognitionRef.current) return
        const r = recognitionRef.current
        recognitionRef.current = null // clear ref first so onend doesn't restart
        r.stop()
        setStatus("idle")
        setInterimText("")
    }, [])

    const clearTranscript = useCallback(() => setTranscript([]), [])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop()
                recognitionRef.current = null
            }
        }
    }, [])

    return (
        <VoiceContext.Provider
            value={{
                status,
                isSupported,
                transcript,
                interimText,
                continuous,
                setContinuous,
                startListening,
                stopListening,
                clearTranscript,
            }}
        >
            {children}
        </VoiceContext.Provider>
    )
}

export { VoiceContextProvider }
export default VoiceContext
