import {
    ReactNode,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react"
import { useAppContext } from "./AppContext"

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000"

// ── Shared types (mirrors backend queries.ts) ─────────────────────────────────

export interface FrequentError {
    snippet: string
    count: number
}

export interface MilestoneSummary {
    filesCreated: number
    chatMessages: number
    aiPrompts: number
    drawings: number
}

export interface StudentSummary {
    username: string
    totalSessions: number
    totalTimeMs: number
    totalRuns: number
    successfulRuns: number
    failedRuns: number
    errorRate: number
    topLanguages: string[]
    frequentErrors: FrequentError[]
    lastSeen: number
    milestones: MilestoneSummary
}

export interface CodeRunRow {
    id: number
    room_id: string
    username: string
    language: string
    file_name: string
    success: number
    error_text: string | null
    ran_at: number
}

export interface RoomSummary {
    roomId: string
    totalStudents: number
    totalSessions: number
    totalTimeMs: number
    totalRuns: number
    errorRate: number
    topLanguages: string[]
    students: StudentSummary[]
    recentRuns: CodeRunRow[]
    lastActivity: number
}

// ── Time-series types ─────────────────────────────────────────────────────────

export interface TimeSeriesBucket {
    ts: number
    totalRuns: number
    successRuns: number
    failedRuns: number
    sessionMs: number
    activeStudents: number
}

export interface StudentActivityRow {
    username: string
    ts: number
    runs: number
    errors: number
}

export interface TimeSeriesPayload {
    roomId: string
    granularity: "hour" | "day"
    buckets: TimeSeriesBucket[]
    perStudent: StudentActivityRow[]
}

// ── Context type ──────────────────────────────────────────────────────────────

export interface AnalyticsContextType {
    roomSummary: RoomSummary | null
    timeSeries: TimeSeriesPayload | null
    isLoading: boolean
    error: string | null
    refresh: () => void
    lastRefreshed: number | null
}

const AnalyticsContext = createContext<AnalyticsContextType | null>(null)

export const useAnalytics = (): AnalyticsContextType => {
    const ctx = useContext(AnalyticsContext)
    if (!ctx) throw new Error("useAnalytics must be used within AnalyticsContextProvider")
    return ctx
}

// ── Provider ──────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000

export function AnalyticsContextProvider({ children }: { children: ReactNode }) {
    const { currentUser } = useAppContext()
    const [roomSummary, setRoomSummary] = useState<RoomSummary | null>(null)
    const [timeSeries, setTimeSeries] = useState<TimeSeriesPayload | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [lastRefreshed, setLastRefreshed] = useState<number | null>(null)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const fetchSummary = useCallback(async () => {
        const roomId = currentUser?.roomId
        if (!roomId) return

        setIsLoading(true)
        setError(null)
        try {
            const [summaryRes, tsRes] = await Promise.all([
                fetch(`${BACKEND_URL}/api/analytics/rooms/${encodeURIComponent(roomId)}`),
                fetch(`${BACKEND_URL}/api/analytics/rooms/${encodeURIComponent(roomId)}/timeseries`),
            ])
            if (!summaryRes.ok) throw new Error(`Server returned ${summaryRes.status}`)
            const data: RoomSummary = await summaryRes.json()
            setRoomSummary(data)

            if (tsRes.ok) {
                const tsData: TimeSeriesPayload = await tsRes.json()
                setTimeSeries(tsData)
            }
            setLastRefreshed(Date.now())
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to load analytics")
        } finally {
            setIsLoading(false)
        }
    }, [currentUser?.roomId])

    useEffect(() => {
        fetchSummary()
        intervalRef.current = setInterval(fetchSummary, POLL_INTERVAL_MS)
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [fetchSummary])

    return (
        <AnalyticsContext.Provider
            value={{
                roomSummary,
                timeSeries,
                isLoading,
                error,
                refresh: fetchSummary,
                lastRefreshed,
            }}
        >
            {children}
        </AnalyticsContext.Provider>
    )
}

export default AnalyticsContext
