import {
    KeystrokeEvent,
    RecordingContext as RecordingContextType,
    RecordingState,
    SessionRecording,
} from "@/types/recording"
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

const RecordingContext = createContext<RecordingContextType | null>(null)

export const useRecording = (): RecordingContextType => {
    const context = useContext(RecordingContext)
    if (!context) {
        throw new Error("useRecording must be used within RecordingContextProvider")
    }
    return context
}

const STORAGE_KEY = "codesync_recordings"

function loadSavedRecordings(): SessionRecording[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw) as SessionRecording[]
        // Strip audio from localStorage (too large) — audio only lives in memory/export
        return parsed.map((r) => ({ ...r, audioDataUrl: undefined }))
    } catch {
        return []
    }
}

function saveRecordingsToStorage(recordings: SessionRecording[]) {
    try {
        // Strip audio before persisting to localStorage (size limit)
        const stripped = recordings.map((r) => ({ ...r, audioDataUrl: undefined }))
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped))
    } catch {
        // localStorage quota exceeded — silent fail
    }
}

function RecordingContextProvider({ children }: { children: ReactNode }) {
    const { currentUser } = useAppContext()

    const [recordingState, setRecordingState] = useState<RecordingState>("idle")
    const [savedRecordings, setSavedRecordings] = useState<SessionRecording[]>(loadSavedRecordings)
    const [elapsedMs, setElapsedMs] = useState(0)
    const [playbackProgress, setPlaybackProgress] = useState(0)
    const [playbackEvent, setPlaybackEvent] = useState<KeystrokeEvent | null>(null)
    const [currentRecording, setCurrentRecording] = useState<SessionRecording | null>(null)

    // Recording refs
    const recordingStartTime = useRef<number>(0)
    const capturedEvents = useRef<KeystrokeEvent[]>([])
    const mediaRecorder = useRef<MediaRecorder | null>(null)
    const audioChunks = useRef<Blob[]>([])
    const elapsedTimer = useRef<ReturnType<typeof setInterval> | null>(null)

    // Playback refs
    const playbackStartWallTime = useRef<number>(0)
    const playbackStartOffset = useRef<number>(0)   // for resume
    const playbackTimers = useRef<ReturnType<typeof setTimeout>[]>([])
    const playbackAudio = useRef<HTMLAudioElement | null>(null)
    const playbackRecording = useRef<SessionRecording | null>(null)

    // ── Elapsed timer ──────────────────────────────────────────────────────────
    const startElapsedTimer = useCallback(() => {
        elapsedTimer.current = setInterval(() => {
            if (recordingState === "recording") {
                setElapsedMs(Date.now() - recordingStartTime.current)
            }
        }, 200)
    }, [recordingState])

    const stopElapsedTimer = useCallback(() => {
        if (elapsedTimer.current) {
            clearInterval(elapsedTimer.current)
            elapsedTimer.current = null
        }
    }, [])

    // ── Start recording ────────────────────────────────────────────────────────
    const startRecording = useCallback(async () => {
        capturedEvents.current = []
        audioChunks.current = []
        recordingStartTime.current = Date.now()
        setElapsedMs(0)

        // Try to get microphone — non-blocking, recording works without audio too
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mr = new MediaRecorder(stream, { mimeType: "audio/webm" })
            mr.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.current.push(e.data)
            }
            mr.start(500) // collect chunks every 500ms
            mediaRecorder.current = mr
        } catch {
            toast("Recording without audio — mic access denied.", { icon: "🎤" })
            mediaRecorder.current = null
        }

        setRecordingState("recording")
        toast.success("Recording started")
    }, [])

    // ── Stop recording ─────────────────────────────────────────────────────────
    const stopRecording = useCallback(
        (title: string) => {
            const duration = Date.now() - recordingStartTime.current

            const finishSave = (audioDataUrl?: string) => {
                const recording: SessionRecording = {
                    id: uuidv4(),
                    title: title.trim() || `Session ${new Date().toLocaleString()}`,
                    createdAt: recordingStartTime.current,
                    duration,
                    events: [...capturedEvents.current],
                    audioDataUrl,
                    recordedBy: currentUser.username,
                }

                setSavedRecordings((prev) => {
                    const updated = [recording, ...prev]
                    saveRecordingsToStorage(updated)
                    return updated
                })
                setRecordingState("idle")
                setElapsedMs(0)
                setCurrentRecording(null)
                toast.success(`Recording "${recording.title}" saved`)
            }

            // Stop MediaRecorder and collect final audio
            if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
                mediaRecorder.current.onstop = () => {
                    const blob = new Blob(audioChunks.current, { type: "audio/webm" })
                    const reader = new FileReader()
                    reader.onloadend = () => finishSave(reader.result as string)
                    reader.readAsDataURL(blob)
                    // Stop all tracks to release mic
                    mediaRecorder.current?.stream.getTracks().forEach((t) => t.stop())
                }
                mediaRecorder.current.stop()
            } else {
                finishSave(undefined)
            }
        },
        [currentUser.username],
    )

    // ── Capture editor event ───────────────────────────────────────────────────
    const captureEvent = useCallback(
        (event: Omit<KeystrokeEvent, "timestamp">) => {
            if (recordingState !== "recording") return
            capturedEvents.current.push({
                ...event,
                timestamp: Date.now() - recordingStartTime.current,
            })
        },
        [recordingState],
    )

    // ── Clear playback timers ──────────────────────────────────────────────────
    const clearPlaybackTimers = useCallback(() => {
        playbackTimers.current.forEach(clearTimeout)
        playbackTimers.current = []
    }, [])

    // ── Schedule playback events ───────────────────────────────────────────────
    const scheduleEvents = useCallback(
        (recording: SessionRecording, startOffset: number) => {
            clearPlaybackTimers()
            const wallStart = Date.now()
            playbackStartWallTime.current = wallStart

            recording.events.forEach((event) => {
                const delay = event.timestamp - startOffset
                if (delay < 0) return

                const t = setTimeout(() => {
                    setPlaybackEvent(event)
                    setPlaybackProgress(event.timestamp / recording.duration)
                    setElapsedMs(event.timestamp)
                }, delay)
                playbackTimers.current.push(t)
            })

            // Mark done when recording ends
            const doneDelay = recording.duration - startOffset
            const doneTimer = setTimeout(() => {
                setRecordingState("idle")
                setPlaybackProgress(1)
                setElapsedMs(recording.duration)
                playbackAudio.current?.pause()
                toast.success("Playback finished")
            }, doneDelay)
            playbackTimers.current.push(doneTimer)
        },
        [clearPlaybackTimers],
    )

    // ── Play recording ─────────────────────────────────────────────────────────
    const playRecording = useCallback(
        (recording: SessionRecording) => {
            clearPlaybackTimers()
            playbackRecording.current = recording
            playbackStartOffset.current = 0
            setCurrentRecording(recording)
            setPlaybackProgress(0)
            setElapsedMs(0)
            setPlaybackEvent(null)
            setRecordingState("playing")

            // Audio
            if (recording.audioDataUrl) {
                const audio = new Audio(recording.audioDataUrl)
                audio.play().catch(() => {})
                playbackAudio.current = audio
            } else {
                playbackAudio.current = null
            }

            scheduleEvents(recording, 0)
            toast.success(`Playing "${recording.title}"`)
        },
        [clearPlaybackTimers, scheduleEvents],
    )

    // ── Pause playback ─────────────────────────────────────────────────────────
    const pausePlayback = useCallback(() => {
        if (recordingState !== "playing") return
        clearPlaybackTimers()
        playbackAudio.current?.pause()
        playbackStartOffset.current = elapsedMs
        setRecordingState("paused")
    }, [clearPlaybackTimers, elapsedMs, recordingState])

    // ── Resume playback ────────────────────────────────────────────────────────
    const resumePlayback = useCallback(() => {
        if (recordingState !== "paused" || !playbackRecording.current) return
        setRecordingState("playing")

        if (playbackAudio.current) {
            playbackAudio.current.currentTime = playbackStartOffset.current / 1000
            playbackAudio.current.play().catch(() => {})
        }

        scheduleEvents(playbackRecording.current, playbackStartOffset.current)
    }, [recordingState, scheduleEvents])

    // ── Stop playback ──────────────────────────────────────────────────────────
    const stopPlayback = useCallback(() => {
        clearPlaybackTimers()
        playbackAudio.current?.pause()
        playbackAudio.current = null
        playbackRecording.current = null
        setRecordingState("idle")
        setCurrentRecording(null)
        setPlaybackEvent(null)
        setPlaybackProgress(0)
        setElapsedMs(0)
    }, [clearPlaybackTimers])

    // ── Delete recording ───────────────────────────────────────────────────────
    const deleteRecording = useCallback((id: string) => {
        setSavedRecordings((prev) => {
            const updated = prev.filter((r) => r.id !== id)
            saveRecordingsToStorage(updated)
            return updated
        })
        toast.success("Recording deleted")
    }, [])

    // ── Export recording ───────────────────────────────────────────────────────
    const exportRecording = useCallback(async (recording: SessionRecording) => {
        try {
            const JSZip = (await import("jszip")).default
            const zip = new JSZip()
            // Save events as JSON
            const { audioDataUrl, ...meta } = recording
            zip.file("session.json", JSON.stringify(meta, null, 2))
            // Save audio if present
            if (audioDataUrl) {
                const base64 = audioDataUrl.split(",")[1]
                zip.file("audio.webm", base64, { base64: true })
            }
            const blob = await zip.generateAsync({ type: "blob" })
            const { saveAs } = await import("file-saver")
            saveAs(blob, `${recording.title.replace(/\s+/g, "_")}.codesync`)
            toast.success("Recording exported")
        } catch (err) {
            console.error(err)
            toast.error("Failed to export recording")
        }
    }, [])

    // ── Import recording ───────────────────────────────────────────────────────
    const importRecording = useCallback(async (file: File) => {
        try {
            const JSZip = (await import("jszip")).default
            const zip = await JSZip.loadAsync(file)
            const sessionJson = await zip.file("session.json")?.async("string")
            if (!sessionJson) throw new Error("Invalid recording file")
            const meta = JSON.parse(sessionJson) as SessionRecording

            let audioDataUrl: string | undefined
            const audioFile = zip.file("audio.webm")
            if (audioFile) {
                const base64 = await audioFile.async("base64")
                audioDataUrl = `data:audio/webm;base64,${base64}`
            }

            const recording: SessionRecording = { ...meta, audioDataUrl }
            setSavedRecordings((prev) => {
                const updated = [recording, ...prev]
                saveRecordingsToStorage(updated)
                return updated
            })
            toast.success(`Imported "${recording.title}"`)
        } catch (err) {
            console.error(err)
            toast.error("Failed to import recording — invalid file")
        }
    }, [])

    // ── Elapsed timer for recording ────────────────────────────────────────────
    useEffect(() => {
        if (recordingState === "recording") {
            startElapsedTimer()
        } else {
            stopElapsedTimer()
        }
        return stopElapsedTimer
    }, [recordingState, startElapsedTimer, stopElapsedTimer])

    // ── Cleanup on unmount ─────────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            clearPlaybackTimers()
            playbackAudio.current?.pause()
        }
    }, [clearPlaybackTimers])

    return (
        <RecordingContext.Provider
            value={{
                recordingState,
                currentRecording,
                savedRecordings,
                elapsedMs,
                playbackProgress,
                playbackEvent,
                startRecording,
                stopRecording,
                playRecording,
                pausePlayback,
                resumePlayback,
                stopPlayback,
                deleteRecording,
                exportRecording,
                importRecording,
                captureEvent,
            }}
        >
            {children}
        </RecordingContext.Provider>
    )
}

export { RecordingContextProvider }
export default RecordingContext
