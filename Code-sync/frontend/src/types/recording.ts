// A single captured editor event during recording
export interface KeystrokeEvent {
    timestamp: number        // ms from recording start
    type: "content" | "file-switch" | "cursor"
    fileId: string
    fileName: string
    content?: string         // full file content snapshot (for content events)
    cursorPosition?: number
    selectionStart?: number
    selectionEnd?: number
}

// The full recording saved to disk
export interface SessionRecording {
    id: string
    title: string
    createdAt: number        // unix ms
    duration: number         // total ms
    events: KeystrokeEvent[]
    audioDataUrl?: string    // base64 webm audio, optional
    recordedBy: string       // username
}

export type RecordingState = "idle" | "recording" | "playing" | "paused"

export interface RecordingContext {
    recordingState: RecordingState
    currentRecording: SessionRecording | null  // recording in progress or being played
    savedRecordings: SessionRecording[]
    elapsedMs: number                           // ms since record/play start
    playbackProgress: number                    // 0-1
    // actions
    startRecording: () => Promise<void>
    stopRecording: (title: string) => void
    playRecording: (recording: SessionRecording) => void
    pausePlayback: () => void
    resumePlayback: () => void
    stopPlayback: () => void
    deleteRecording: (id: string) => void
    exportRecording: (recording: SessionRecording) => void
    importRecording: (file: File) => Promise<void>
    // called by Editor to capture events
    captureEvent: (event: Omit<KeystrokeEvent, "timestamp">) => void
    // playback state for PlaybackEditor
    playbackEvent: KeystrokeEvent | null
}
