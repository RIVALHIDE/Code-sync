import { useVoice, TranscriptEntry } from "@/context/VoiceContext"
import { useFileSystem } from "@/context/FileContext"
import useResponsive from "@/hooks/useResponsive"
import { useState } from "react"
import {
    LuMic,
    LuMicOff,
    LuTrash2,
    LuChevronDown,
    LuChevronUp,
    LuInfo,
} from "react-icons/lu"
import { PiWaveform } from "react-icons/pi"
import cn from "classnames"

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

// ── Status indicator dot ───────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
    return (
        <span
            className={cn("inline-block h-2 w-2 rounded-full", {
                "bg-green-400 animate-pulse": status === "listening",
                "bg-yellow-400 animate-pulse": status === "processing",
                "bg-red-400": status === "error",
                "bg-white/20": status === "idle",
            })}
        />
    )
}

// ── Transcript entry row ───────────────────────────────────────────────────────

function EntryRow({ entry }: { entry: TranscriptEntry }) {
    return (
        <div
            className={cn(
                "sidebar-voice-entry flex flex-col gap-0.5 rounded-lg border px-3 py-2",
                {
                    "border-primary/20 bg-primary/5": entry.type === "dictation",
                    "border-yellow-400/20 bg-yellow-400/5": entry.type === "command",
                    "border-red-400/20 bg-red-400/5": entry.type === "error",
                },
            )}
        >
            <div className="sidebar-voice-entry-heading">
                <span
                    className={cn("min-w-0 leading-snug", {
                        "text-white/85": entry.type === "dictation",
                        "font-mono text-yellow-300": entry.type === "command",
                        "text-red-400": entry.type === "error",
                    })}
                >
                    {entry.text}
                </span>
                <span className="shrink-0 text-xs text-white/25 pt-0.5">
                    {formatTime(entry.timestamp)}
                </span>
            </div>
            <span className="text-xs text-white/30 capitalize">{entry.type}</span>
        </div>
    )
}

// ── Command reference cheat-sheet ─────────────────────────────────────────────

const COMMAND_GROUPS = [
    {
        label: "Navigation",
        commands: [
            ["new line", "Insert newline"],
            ["blank line", "Insert empty line"],
            ["go to beginning of line", "Move cursor to line start"],
            ["go to end of line", "Move cursor to line end"],
        ],
    },
    {
        label: "Editing",
        commands: [
            ["delete word", "Delete previous word"],
            ["delete line", "Delete current line"],
            ["clear all", "Clear entire file"],
            ["indent / tab", "Add 4-space indent"],
            ["dedent", "Remove one indent level"],
        ],
    },
    {
        label: "Symbols",
        commands: [
            ["open paren / close paren", "( )"],
            ["open bracket / close bracket", "[ ]"],
            ["open brace / close brace", "{ }"],
            ["colon / semicolon / comma / dot", ": ; , ."],
            ["equals / double equals / triple equals", "= == ==="],
            ["arrow", "=>"],
            ["hash / at sign / underscore", "# @ _"],
            ["dash / plus / star / slash", "- + * /"],
            ["pipe / ampersand / bang", "| & !"],
            ["quote / double quote / backtick", "' \" `"],
            ["space", "Insert space"],
        ],
    },
]

function CommandRef() {
    return (
        <div className="flex flex-col gap-3">
            {COMMAND_GROUPS.map((group) => (
                <div key={group.label} className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                        {group.label}
                    </span>
                    <div className="flex flex-col gap-0.5">
                        {group.commands.map(([cmd, desc]) => (
                            <div key={cmd} className="sidebar-voice-command">
                                <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs font-mono text-white/80 leading-snug">
                                    {cmd}
                                </code>
                                <span className="text-xs text-white/40 text-right leading-snug pt-0.5">
                                    {desc}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            <p className="text-xs text-white/30 italic leading-snug">
                Any phrase not matching a command is inserted as text into the active file at the current cursor position.
            </p>
        </div>
    )
}

// ── Main view ──────────────────────────────────────────────────────────────────

function VoiceView() {
    const { viewHeight } = useResponsive()
    const { activeFile } = useFileSystem()
    const {
        status,
        isSupported,
        transcript,
        interimText,
        continuous,
        setContinuous,
        startListening,
        stopListening,
        clearTranscript,
    } = useVoice()

    const [showCommands, setShowCommands] = useState(false)
    const isListening = status === "listening" || status === "processing"

    const statusLabel: Record<string, string> = {
        idle: "Idle — press the mic to start",
        listening: "Listening…",
        processing: "Processing…",
        error: "Error — try again",
    }

    return (
        <div
            className="sidebar-panel sidebar-panel--voice"
            style={{ height: viewHeight }}
        >
            {/* Header */}
            <div className="sidebar-panel-header sidebar-panel-header--start">
                <PiWaveform size={18} className="text-primary" />
                <h1 className="sidebar-panel-title">Voice to Code</h1>
            </div>

            {/* Browser support warning */}
            {!isSupported && (
                <div className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/10 p-3">
                    <LuInfo size={14} className="mt-0.5 shrink-0 text-red-400" />
                    <p className="text-xs text-red-300 leading-snug">
                        Speech recognition is not supported in this browser. Please use Chrome
                        or Edge for full support.
                    </p>
                </div>
            )}

            {/* Brave browser warning */}
            {isSupported && (navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } }).brave && (
                <div className="flex items-start gap-2 rounded-lg border border-yellow-400/30 bg-yellow-400/10 p-3">
                    <LuInfo size={14} className="mt-0.5 shrink-0 text-yellow-400" />
                    <p className="text-xs text-yellow-300 leading-snug">
                        Brave Browser may block the speech API. If you see network errors,
                        disable Brave Shields for this page or use Chrome.
                    </p>
                </div>
            )}

            {/* No file open warning */}
            {!activeFile && (
                <div className="flex items-start gap-2 rounded-lg border border-yellow-400/30 bg-yellow-400/10 p-3">
                    <LuInfo size={14} className="mt-0.5 shrink-0 text-yellow-400" />
                    <p className="text-xs text-yellow-300 leading-snug">
                        No file is open. Open a file in the editor before dictating.
                    </p>
                </div>
            )}

            {/* Status bar */}
            <div className="sidebar-voice-status flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-darkHover px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                    <StatusDot status={status} />
                    <span className="text-xs text-white/60">{statusLabel[status]}</span>
                </div>
                {activeFile && (
                    <span className="max-w-[120px] truncate text-xs text-white/30">
                        {activeFile.name}
                    </span>
                )}
            </div>

            {/* Mic button */}
            <div className="sidebar-voice-mic-area">
                <button
                    onClick={isListening ? stopListening : startListening}
                    disabled={!isSupported || !activeFile}
                    aria-label={isListening ? "Stop listening" : "Start listening"}
                    className={cn(
                        "sidebar-voice-mic flex items-center justify-center rounded-full border transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40",
                        {
                            "border-red-400 bg-red-400/20 shadow-[0_0_24px_rgba(248,113,113,0.4)] hover:bg-red-400/30":
                                isListening,
                            "border-primary bg-primary/10 hover:bg-primary/20":
                                !isListening,
                        },
                    )}
                >
                    {isListening ? (
                        <LuMicOff size={24} className="text-red-400" />
                    ) : (
                        <LuMic size={24} className="text-primary" />
                    )}
                </button>

                <p className="text-center text-xs text-white/40">
                    {isListening
                        ? "Click to stop · speak naturally"
                        : "Click to start dictating"}
                </p>
            </div>

            {/* Continuous mode toggle */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-darkHover px-3 py-2">
                <div className="min-w-0 flex flex-col">
                    <span className="text-xs font-medium text-white/70">Continuous mode</span>
                    <span className="text-xs text-white/30">
                        Keep mic open between phrases
                    </span>
                </div>
                <button
                    role="switch"
                    aria-label="Continuous mode"
                    aria-checked={continuous}
                    onClick={() => {
                        if (isListening) stopListening()
                        setContinuous(!continuous)
                    }}
                    className={cn(
                        "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200",
                        continuous ? "bg-primary" : "bg-white/20",
                    )}
                >
                    <span
                        className={cn(
                            "absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200",
                            continuous ? "translate-x-4" : "translate-x-0.5",
                        )}
                    />
                </button>
            </div>

            {/* Interim / live preview */}
            {interimText && (
                <div className="rounded-lg border border-white/10 bg-darkHover px-3 py-2">
                    <p className="text-xs text-white/30 mb-1">Hearing…</p>
                    <p className="text-sm italic text-white/50">{interimText}</p>
                </div>
            )}

            {/* Transcript */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white/50">
                        Transcript ({transcript.length})
                    </span>
                    {transcript.length > 0 && (
                        <button
                            onClick={clearTranscript}
                            className="flex items-center gap-1 text-xs text-white/30 transition-colors hover:text-red-400"
                            title="Clear transcript"
                        >
                            <LuTrash2 size={12} />
                            Clear
                        </button>
                    )}
                </div>

                {transcript.length === 0 ? (
                    <p className="text-xs italic text-white/25">
                        Your dictated text and commands will appear here.
                    </p>
                ) : (
                    <div className="flex flex-col gap-1.5">
                        {transcript.map((entry) => (
                            <EntryRow key={entry.id} entry={entry} />
                        ))}
                    </div>
                )}
            </div>

            {/* Command reference */}
            <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-darkHover p-3">
                <button
                    onClick={() => setShowCommands((v) => !v)}
                    aria-expanded={showCommands}
                    className="flex items-center justify-between text-xs font-medium text-white/50 hover:text-white/70 transition-colors"
                >
                    <span className="flex items-center gap-1.5">
                        <LuInfo size={13} />
                        Voice commands reference
                    </span>
                    {showCommands ? (
                        <LuChevronUp size={13} />
                    ) : (
                        <LuChevronDown size={13} />
                    )}
                </button>
                {showCommands && (
                    <div className="mt-1 border-t border-white/10 pt-3">
                        <CommandRef />
                    </div>
                )}
            </div>
        </div>
    )
}

export default VoiceView
