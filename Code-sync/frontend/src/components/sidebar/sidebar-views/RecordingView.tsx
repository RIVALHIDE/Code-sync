import PlaybackEditor from "@/components/recording/PlaybackEditor"
import { useRecording } from "@/context/RecordingContext"
import useResponsive from "@/hooks/useResponsive"
import { SessionRecording } from "@/types/recording"
import { useRef, useState } from "react"
import {
    LuCircle,
    LuDownload,
    LuPause,
    LuPlay,
    LuSquare,
    LuTrash2,
    LuUpload,
} from "react-icons/lu"
import { MdFiberManualRecord } from "react-icons/md"

// Format ms → mm:ss
function fmtTime(ms: number): string {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
}

function RecordingCard({
    recording,
    isPlaying,
    isPaused,
}: {
    recording: SessionRecording
    isPlaying: boolean
    isPaused: boolean
}) {
    const { playRecording, pausePlayback, resumePlayback, stopPlayback, deleteRecording, exportRecording, playbackProgress, elapsedMs } =
        useRecording()

    return (
        <div
            className={`sidebar-recording-card flex flex-col gap-2 rounded-lg border p-3 transition-colors ${
                isPlaying || isPaused
                    ? "border-primary/50 bg-primary/5"
                    : "border-white/10 bg-darkHover"
            }`}
        >
            {/* Title + meta */}
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex flex-col">
                    <span className="sidebar-recording-title">
                        {recording.title}
                    </span>
                    <span className="mt-0.5 text-xs text-white/40">
                        {new Date(recording.createdAt).toLocaleString()} ·{" "}
                        {fmtTime(recording.duration)} · by {recording.recordedBy}
                        {recording.audioDataUrl && " · 🎤"}
                    </span>
                </div>
            </div>

            {/* Progress bar during playback */}
            {(isPlaying || isPaused) && (
                <div className="flex flex-col gap-1">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                            className="h-full rounded-full bg-primary transition-all duration-200"
                            style={{ width: `${playbackProgress * 100}%` }}
                        />
                    </div>
                    <span className="text-xs text-white/40">
                        {fmtTime(elapsedMs)} / {fmtTime(recording.duration)}
                    </span>
                </div>
            )}

            {/* Controls */}
            <div className="sidebar-recording-controls">
                {!isPlaying && !isPaused && (
                    <button
                        onClick={() => playRecording(recording)}
                        className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-dark transition-opacity hover:opacity-90"
                    >
                        <LuPlay size={12} />
                        Play
                    </button>
                )}
                {isPlaying && (
                    <button
                        onClick={pausePlayback}
                        className="flex items-center gap-1.5 rounded-md bg-yellow-500/20 px-3 py-1.5 text-xs font-semibold text-yellow-400 transition-colors hover:bg-yellow-500/30"
                    >
                        <LuPause size={12} />
                        Pause
                    </button>
                )}
                {isPaused && (
                    <button
                        onClick={resumePlayback}
                        className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-dark transition-opacity hover:opacity-90"
                    >
                        <LuPlay size={12} />
                        Resume
                    </button>
                )}
                {(isPlaying || isPaused) && (
                    <button
                        onClick={stopPlayback}
                        className="flex items-center gap-1.5 rounded-md bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/30"
                    >
                        <LuSquare size={12} />
                        Stop
                    </button>
                )}
                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={() => exportRecording(recording)}
                        title="Export recording"
                        className="text-white/40 transition-colors hover:text-white"
                    >
                        <LuDownload size={15} />
                    </button>
                    <button
                        onClick={() => deleteRecording(recording.id)}
                        title="Delete recording"
                        className="text-white/40 transition-colors hover:text-red-400"
                    >
                        <LuTrash2 size={15} />
                    </button>
                </div>
            </div>
        </div>
    )
}

function RecordingView() {
    const { viewHeight } = useResponsive()
    const {
        recordingState,
        currentRecording,
        savedRecordings,
        elapsedMs,
        startRecording,
        stopRecording,
        importRecording,
        stopPlayback,
    } = useRecording()

    const [titleInput, setTitleInput] = useState("")
    const [showStopDialog, setShowStopDialog] = useState(false)
    const importRef = useRef<HTMLInputElement>(null)

    const isRecording = recordingState === "recording"
    const isPlaying = recordingState === "playing"
    const isPaused = recordingState === "paused"
    const isPlayingOrPaused = isPlaying || isPaused

    const handleStartRecording = async () => {
        setTitleInput("")
        await startRecording()
    }

    const handleStopClick = () => {
        setShowStopDialog(true)
    }

    const handleConfirmStop = () => {
        stopRecording(titleInput)
        setShowStopDialog(false)
        setTitleInput("")
    }

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        await importRecording(file)
        e.target.value = ""
    }

    return (
        <div
            className="sidebar-panel sidebar-panel--recordings"
            style={{ height: viewHeight }}
        >
            <div className="sidebar-panel-header">
                <h1 className="sidebar-panel-title">Session Recordings</h1>
            </div>

            {/* ── Recording controls ── */}
            {!isRecording && !isPlayingOrPaused && (
                <button
                    onClick={handleStartRecording}
                    className="sidebar-panel-button sidebar-panel-button--danger"
                >
                    <MdFiberManualRecord size={18} />
                    Start Recording
                </button>
            )}

            {isRecording && (
                <div className="flex flex-col gap-2 rounded-lg border border-red-500/40 bg-red-500/5 p-3">
                    <div className="flex items-center gap-2">
                        <LuCircle
                            size={12}
                            className="animate-pulse fill-red-500 text-red-500"
                        />
                        <span className="text-sm font-semibold text-red-400">
                            Recording — {fmtTime(elapsedMs)}
                        </span>
                    </div>
                    <p className="text-xs text-white/40">
                        All keystrokes and audio are being captured.
                    </p>
                    <button
                        onClick={handleStopClick}
                        className="sidebar-panel-button sidebar-panel-button--danger"
                    >
                        <LuSquare size={14} />
                        Stop Recording
                    </button>
                </div>
            )}

            {/* ── Stop dialog ── */}
            {showStopDialog && (
                <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-darkHover p-3">
                    <label className="text-xs text-white/60" htmlFor="recording-title">
                        Name this recording:
                    </label>
                    <input
                        id="recording-title"
                        autoFocus
                        type="text"
                        value={titleInput}
                        onChange={(e) => setTitleInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleConfirmStop()}
                        placeholder={`Session ${new Date().toLocaleDateString()}`}
                        className="rounded-md bg-dark px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-primary/50"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={handleConfirmStop}
                            className="flex-1 rounded-md bg-primary py-1.5 text-sm font-semibold text-dark hover:opacity-90"
                        >
                            Save
                        </button>
                        <button
                            onClick={() => setShowStopDialog(false)}
                            className="flex-1 rounded-md bg-white/10 py-1.5 text-sm text-white hover:bg-white/20"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* ── Active playback editor ── */}
            {isPlayingOrPaused && currentRecording && (
                <div className="sidebar-recording-playback flex flex-col gap-2">
                    <div className="sidebar-panel-row">
                        <span className="sidebar-recording-now-playing text-xs font-medium text-primary">
                            ▶ Playing: {currentRecording.title}
                        </span>
                        <button
                            onClick={stopPlayback}
                            className="sidebar-panel-icon-button text-xs text-white/40 hover:text-red-400"
                        >
                            Stop
                        </button>
                    </div>
                    <PlaybackEditor />
                </div>
            )}

            {/* ── Import button ── */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => importRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs text-white transition-colors hover:bg-white/20"
                >
                    <LuUpload size={13} />
                    Import .codesync
                </button>
                <input
                    ref={importRef}
                    type="file"
                    accept=".codesync,.zip"
                    className="hidden"
                    onChange={handleImport}
                />
            </div>

            {/* ── Saved recordings list ── */}
            <div className="flex flex-col gap-2">
                {savedRecordings.length === 0 ? (
                    <p className="sidebar-panel-empty">
                        No recordings yet. Start a session above.
                    </p>
                ) : (
                    savedRecordings.map((r) => (
                        <RecordingCard
                            key={r.id}
                            recording={r}
                            isPlaying={isPlaying && currentRecording?.id === r.id}
                            isPaused={isPaused && currentRecording?.id === r.id}
                        />
                    ))
                )}
            </div>
        </div>
    )
}

export default RecordingView
