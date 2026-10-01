import { useAnalytics } from "@/context/AnalyticsContext"
import type {
    StudentSummary,
    CodeRunRow,
    TimeSeriesBucket,
    TimeSeriesPayload,
} from "@/context/AnalyticsContext"
import useResponsive from "@/hooks/useResponsive"
import { useState, useCallback } from "react"
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    Legend,
} from "recharts"
import {
    LuRefreshCw,
    LuClock,
    LuCode2,
    LuAlertTriangle,
    LuCheckCircle2,
    LuChevronDown,
    LuChevronRight,
    LuUsers,
    LuFileCode2,
    LuMessageSquare,
    LuSparkles,
    LuPenLine,
    LuDownload,
    LuActivity,
    LuTrendingUp,
} from "react-icons/lu"

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
    if (ms < 1000) return "< 1s"
    const totalSec = Math.floor(ms / 1000)
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    if (h > 0) return `${h}h ${m}m`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
}

function fmtTime(ts: number): string {
    if (!ts) return "—"
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function fmtBucketLabel(ts: number, granularity: "hour" | "day"): string {
    const d = new Date(ts)
    if (granularity === "hour") {
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" })
}

// ── CSV Export ────────────────────────────────────────────────────────────────

function exportCSV(
    roomId: string,
    students: StudentSummary[],
    recentRuns: CodeRunRow[],
): void {
    const escape = (v: string | number) => {
        const s = String(v)
        return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s
    }

    const rows: string[][] = []

    // ── Student summary sheet ──
    rows.push(["=== Student Summary ==="])
    rows.push([
        "Username",
        "Sessions",
        "Total Coding Time",
        "Total Runs",
        "Passed",
        "Failed",
        "Error Rate %",
        "Top Languages",
        "Files Created",
        "Chat Messages",
        "AI Prompts",
        "Drawings",
        "Last Seen",
    ])
    for (const s of students) {
        rows.push([
            s.username,
            String(s.totalSessions),
            fmtMs(s.totalTimeMs),
            String(s.totalRuns),
            String(s.successfulRuns),
            String(s.failedRuns),
            String(Math.round(s.errorRate * 100)),
            s.topLanguages.join("; "),
            String(s.milestones.filesCreated),
            String(s.milestones.chatMessages),
            String(s.milestones.aiPrompts),
            String(s.milestones.drawings),
            s.lastSeen ? new Date(s.lastSeen).toISOString() : "—",
        ])
    }

    rows.push([])
    rows.push(["=== Frequent Errors ==="])
    rows.push(["Username", "Error Snippet", "Count"])
    for (const s of students) {
        for (const fe of s.frequentErrors) {
            rows.push([s.username, fe.snippet, String(fe.count)])
        }
    }

    rows.push([])
    rows.push(["=== Recent Code Runs ==="])
    rows.push(["Username", "Language", "File", "Result", "Error", "Timestamp"])
    for (const r of recentRuns) {
        rows.push([
            r.username,
            r.language,
            r.file_name,
            r.success ? "Pass" : "Fail",
            r.error_text ?? "",
            new Date(r.ran_at).toISOString(),
        ])
    }

    const csv = rows.map((r) => r.map(escape).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `analytics-${roomId}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
}

// ── Error Rate Bar ────────────────────────────────────────────────────────────

function ErrorRate({ rate }: { rate: number }) {
    const pct = Math.round(rate * 100)
    const color =
        pct >= 60 ? "text-red-400" : pct >= 30 ? "text-yellow-400" : "text-green-400"
    const barColor =
        pct >= 60 ? "bg-red-500" : pct >= 30 ? "bg-yellow-500" : "bg-green-500"
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Error rate</span>
                <span className={`font-semibold ${color}`}>{pct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-darkHover">
                <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    )
}

// ── Stat / Milestone helpers ──────────────────────────────────────────────────

function StatCell({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode
    label: string
    value: string
}) {
    return (
        <div className="sidebar-dashboard-stat flex min-w-0 flex-col items-center gap-0.5 rounded bg-darkHover px-1 py-2">
            <div className="flex items-center gap-1">
                {icon}
                <span className="text-xs font-semibold text-white">{value}</span>
            </div>
            <span className="text-xs text-gray-500">{label}</span>
        </div>
    )
}

function MilestoneChip({
    icon,
    label,
    count,
}: {
    icon: React.ReactNode
    label: string
    count: number
}) {
    return (
        <span className="sidebar-dashboard-milestone flex min-w-0 items-center gap-1 rounded bg-darkHover px-2 py-1 text-gray-300">
            {icon}
            <span className="text-xs">{label}</span>
            <span className="ml-auto text-xs font-semibold text-white">{count}</span>
        </span>
    )
}

// ── Student Card ──────────────────────────────────────────────────────────────

function StudentCard({ student }: { student: StudentSummary }) {
    const [expanded, setExpanded] = useState(false)
    const errorPct = Math.round(student.errorRate * 100)
    const badgeColor =
        errorPct >= 60
            ? "bg-red-500/20 text-red-400"
            : errorPct >= 30
              ? "bg-yellow-500/20 text-yellow-400"
              : "bg-green-500/20 text-green-400"

    return (
        <div className="sidebar-dashboard-student rounded-lg border border-darkHover bg-dark/60 p-3">
            {/* Header row */}
            <button
                className="sidebar-dashboard-student-heading"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
            >
                <div className="sidebar-dashboard-student-identity">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                        {student.username.slice(0, 1).toUpperCase()}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-left text-xs font-medium text-white" title={student.username}>
                        {student.username}
                    </span>
                    <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor}`}>
                        {errorPct}% err
                    </span>
                </div>
                <div className="sidebar-dashboard-student-meta text-xs text-gray-400">
                    <span title="Coding time">{fmtMs(student.totalTimeMs)}</span>
                    <span title="Total runs">{student.totalRuns} runs</span>
                    {expanded ? (
                        <LuChevronDown size={14} />
                    ) : (
                        <LuChevronRight size={14} />
                    )}
                </div>
            </button>

            {/* Expanded detail */}
            {expanded && (
                <div className="mt-3 space-y-3 border-t border-darkHover pt-3">
                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <StatCell
                            icon={<LuCheckCircle2 size={13} className="text-green-400" />}
                            label="Passed"
                            value={String(student.successfulRuns)}
                        />
                        <StatCell
                            icon={<LuAlertTriangle size={13} className="text-red-400" />}
                            label="Failed"
                            value={String(student.failedRuns)}
                        />
                        <StatCell
                            icon={<LuClock size={13} className="text-blue-400" />}
                            label="Time"
                            value={fmtMs(student.totalTimeMs)}
                        />
                    </div>

                    {/* Error rate bar */}
                    <ErrorRate rate={student.errorRate} />

                    {/* Languages */}
                    {student.topLanguages.length > 0 && (
                        <div>
                            <p className="mb-1 text-xs text-gray-400">Top languages</p>
                            <div className="flex flex-wrap gap-1">
                                {student.topLanguages.map((lang) => (
                                    <span
                                        key={lang}
                                        className="rounded bg-darkHover px-2 py-0.5 text-xs text-gray-300"
                                    >
                                        {lang}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Milestones */}
                    <div>
                        <p className="mb-1 text-xs text-gray-400">Activity</p>
                        <div className="sidebar-dashboard-milestones">
                            <MilestoneChip
                                icon={<LuFileCode2 size={11} />}
                                label="Files created"
                                count={student.milestones.filesCreated}
                            />
                            <MilestoneChip
                                icon={<LuMessageSquare size={11} />}
                                label="Chat msgs"
                                count={student.milestones.chatMessages}
                            />
                            <MilestoneChip
                                icon={<LuSparkles size={11} />}
                                label="AI prompts"
                                count={student.milestones.aiPrompts}
                            />
                            <MilestoneChip
                                icon={<LuPenLine size={11} />}
                                label="Drawings"
                                count={student.milestones.drawings}
                            />
                        </div>
                    </div>

                    {/* Frequent errors */}
                    {student.frequentErrors.length > 0 && (
                        <div>
                            <p className="mb-1 text-xs text-gray-400">Frequent errors</p>
                            <ul className="space-y-1">
                                {student.frequentErrors.map((fe, i) => (
                                    <li
                                        key={i}
                                        className="flex items-start gap-2 rounded bg-red-950/30 px-2 py-1.5 ring-1 ring-red-500/20"
                                    >
                                        <LuAlertTriangle
                                            size={12}
                                            className="mt-0.5 flex-shrink-0 text-red-400"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <code className="block truncate text-xs text-red-300">
                                                {fe.snippet}
                                            </code>
                                            <span className="text-xs text-gray-400">
                                                ×{fe.count}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <p className="text-right text-xs text-gray-500">
                        Last seen {fmtTime(student.lastSeen)}
                    </p>
                </div>
            )}
        </div>
    )
}

// ── Room Overview Strip ───────────────────────────────────────────────────────

function OverviewTile({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode
    label: string
    value: string
}) {
    return (
        <div className="sidebar-dashboard-overview-tile flex min-w-0 items-start gap-2 rounded bg-dark/60 px-2 py-2">
            {icon}
            <div className="min-w-0">
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-sm font-bold text-white">{value}</p>
            </div>
        </div>
    )
}

function RoomOverview() {
    const { roomSummary } = useAnalytics()
    if (!roomSummary) return null

    const { totalStudents, totalRuns, totalTimeMs, errorRate, topLanguages } = roomSummary

    return (
        <div className="rounded-lg border border-darkHover bg-darkHover/50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Room overview
            </p>
            <div className="grid grid-cols-2 gap-2">
                <OverviewTile
                    icon={<LuUsers size={14} className="text-blue-400" />}
                    label="Students"
                    value={String(totalStudents)}
                />
                <OverviewTile
                    icon={<LuCode2 size={14} className="text-purple-400" />}
                    label="Total runs"
                    value={String(totalRuns)}
                />
                <OverviewTile
                    icon={<LuClock size={14} className="text-cyan-400" />}
                    label="Total coding time"
                    value={fmtMs(totalTimeMs)}
                />
                <OverviewTile
                    icon={<LuAlertTriangle size={14} className="text-yellow-400" />}
                    label="Avg error rate"
                    value={`${Math.round(errorRate * 100)}%`}
                />
            </div>
            {topLanguages.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                    {topLanguages.map((lang) => (
                        <span
                            key={lang}
                            className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                        >
                            {lang}
                        </span>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Activity Chart ────────────────────────────────────────────────────────────

function ActivityChart({ ts }: { ts: TimeSeriesPayload }) {
    type ChartTab = "runs" | "time" | "students"
    const [tab, setTab] = useState<ChartTab>("runs")

    if (ts.buckets.length === 0) return null

    const data = ts.buckets.map((b: TimeSeriesBucket) => ({
        label: fmtBucketLabel(b.ts, ts.granularity),
        passed: b.successRuns,
        failed: b.failedRuns,
        sessionMin: Math.round(b.sessionMs / 60000),
        students: b.activeStudents,
    }))

    const tabs: { key: ChartTab; label: string; icon: React.ReactNode }[] = [
        { key: "runs", label: "Runs", icon: <LuCode2 size={11} /> },
        { key: "time", label: "Time", icon: <LuClock size={11} /> },
        { key: "students", label: "Active", icon: <LuUsers size={11} /> },
    ]

    return (
        <div className="rounded-lg border border-darkHover bg-darkHover/50 p-3">
            <div className="sidebar-dashboard-chart-heading">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    <LuActivity size={12} />
                    Activity over time
                </p>
                <div className="sidebar-dashboard-chart-tabs" aria-label="Activity metric">
                    {tabs.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            aria-pressed={tab === t.key}
                            className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors ${
                                tab === t.key
                                    ? "bg-primary/20 text-primary"
                                    : "text-gray-400 hover:text-gray-200"
                            }`}
                        >
                            {t.icon}
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="sidebar-dashboard-chart h-36">
                {tab === "runs" && (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} barSize={8} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                            <XAxis
                                dataKey="label"
                                tick={{ fill: "#6b7280", fontSize: 9 }}
                                tickLine={false}
                                axisLine={false}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                tick={{ fill: "#6b7280", fontSize: 9 }}
                                tickLine={false}
                                axisLine={false}
                                allowDecimals={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    background: "#1e1e2e",
                                    border: "1px solid #333",
                                    borderRadius: 6,
                                    fontSize: 11,
                                }}
                                labelStyle={{ color: "#9ca3af" }}
                            />
                            <Legend
                                iconType="circle"
                                iconSize={7}
                                wrapperStyle={{ fontSize: 10, color: "#9ca3af", paddingTop: 4 }}
                            />
                            <Bar dataKey="passed" stackId="a" fill="#22c55e" name="Passed" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="failed" stackId="a" fill="#ef4444" name="Failed" radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                )}

                {tab === "time" && (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                            <defs>
                                <linearGradient id="timeGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                            <XAxis
                                dataKey="label"
                                tick={{ fill: "#6b7280", fontSize: 9 }}
                                tickLine={false}
                                axisLine={false}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                tick={{ fill: "#6b7280", fontSize: 9 }}
                                tickLine={false}
                                axisLine={false}
                                unit="m"
                            />
                            <Tooltip
                                contentStyle={{
                                    background: "#1e1e2e",
                                    border: "1px solid #333",
                                    borderRadius: 6,
                                    fontSize: 11,
                                }}
                                labelStyle={{ color: "#9ca3af" }}
                                formatter={(v: number) => [`${v} min`, "Session time"]}
                            />
                            <Area
                                type="monotone"
                                dataKey="sessionMin"
                                stroke="#06b6d4"
                                strokeWidth={2}
                                fill="url(#timeGrad)"
                                name="Session time (min)"
                                dot={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}

                {tab === "students" && (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                            <defs>
                                <linearGradient id="studGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                            <XAxis
                                dataKey="label"
                                tick={{ fill: "#6b7280", fontSize: 9 }}
                                tickLine={false}
                                axisLine={false}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                tick={{ fill: "#6b7280", fontSize: 9 }}
                                tickLine={false}
                                axisLine={false}
                                allowDecimals={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    background: "#1e1e2e",
                                    border: "1px solid #333",
                                    borderRadius: 6,
                                    fontSize: 11,
                                }}
                                labelStyle={{ color: "#9ca3af" }}
                                formatter={(v: number) => [v, "Active students"]}
                            />
                            <Area
                                type="monotone"
                                dataKey="students"
                                stroke="#a855f7"
                                strokeWidth={2}
                                fill="url(#studGrad)"
                                name="Active students"
                                dot={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    )
}

// ── Recent Runs Panel ─────────────────────────────────────────────────────────

function RecentRunsPanel({ runs }: { runs: CodeRunRow[] }) {
    const [expanded, setExpanded] = useState(false)

    if (runs.length === 0) return null

    const visible = expanded ? runs : runs.slice(0, 5)

    return (
        <div className="rounded-lg border border-darkHover bg-darkHover/50 p-3">
            <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    <LuTrendingUp size={12} />
                    Recent runs
                </p>
                <span className="rounded-full bg-darkHover px-2 py-0.5 text-xs text-gray-400">
                    {runs.length}
                </span>
            </div>

            <ul className="space-y-1">
                {visible.map((r) => (
                    <li
                        key={r.id}
                        className={`sidebar-dashboard-run rounded px-2 py-2 text-xs ${
                            r.success
                                ? "bg-green-950/20 ring-1 ring-green-500/15"
                                : "bg-red-950/20 ring-1 ring-red-500/15"
                        }`}
                    >
                        {/* pass / fail dot */}
                        <span
                            className={`sidebar-dashboard-run-dot h-1.5 w-1.5 rounded-full ${
                                r.success ? "bg-green-400" : "bg-red-400"
                            }`}
                        />

                        {/* user */}
                        <span className="sidebar-dashboard-run-user truncate font-medium text-white" title={r.username}>
                            {r.username}
                        </span>

                        {/* language badge */}
                        <span className="sidebar-dashboard-run-language rounded bg-darkHover px-1.5 py-0.5 text-gray-300">
                            {r.language}
                        </span>

                        {/* file name */}
                        <span className="sidebar-dashboard-run-file truncate text-gray-400" title={r.file_name}>{r.file_name}</span>

                        {/* error preview */}
                        {!r.success && r.error_text && (
                            <span
                                className="sidebar-dashboard-run-error truncate text-red-400"
                                title={r.error_text}
                            >
                                {r.error_text.slice(0, 40)}
                            </span>
                        )}

                        {/* timestamp */}
                        <span className="sidebar-dashboard-run-time text-gray-500">
                            {fmtTime(r.ran_at)}
                        </span>
                    </li>
                ))}
            </ul>

            {runs.length > 5 && (
                <button
                    onClick={() => setExpanded((v) => !v)}
                    className="mt-2 flex w-full items-center justify-center gap-1 rounded py-1 text-xs text-gray-400 hover:text-white transition-colors hover:bg-darkHover"
                >
                    {expanded ? (
                        <>
                            <LuChevronDown size={12} /> Show less
                        </>
                    ) : (
                        <>
                            <LuChevronRight size={12} /> Show {runs.length - 5} more
                        </>
                    )}
                </button>
            )}
        </div>
    )
}

// ── Main View ─────────────────────────────────────────────────────────────────

function DashboardView() {
    const { viewHeight } = useResponsive()
    const { roomSummary, timeSeries, isLoading, error, refresh, lastRefreshed } =
        useAnalytics()

    const studentsAtRisk =
        roomSummary?.students.filter((s) => s.errorRate >= 0.5) ?? []
    const studentsOk =
        roomSummary?.students.filter((s) => s.errorRate < 0.5) ?? []

    const handleExport = useCallback(() => {
        if (!roomSummary) return
        exportCSV(
            roomSummary.roomId,
            roomSummary.students,
            roomSummary.recentRuns,
        )
    }, [roomSummary])

    return (
        <div
            className="sidebar-panel sidebar-panel--dashboard"
            style={{ height: viewHeight }}
        >
            {/* ── Header ── */}
            <div className="sidebar-panel-header">
                <h1 className="sidebar-panel-title">Analytics</h1>
                <div className="flex items-center gap-1">
                    {roomSummary && (
                        <button
                            onClick={handleExport}
                            title="Export CSV"
                            className="sidebar-panel-icon-button"
                            aria-label="Export analytics as CSV"
                        >
                            <LuDownload size={15} />
                        </button>
                    )}
                    <button
                        onClick={refresh}
                        disabled={isLoading}
                        title="Refresh"
                        className="sidebar-panel-icon-button"
                        aria-label="Refresh analytics"
                    >
                        <LuRefreshCw
                            size={15}
                            className={isLoading ? "animate-spin" : ""}
                        />
                    </button>
                </div>
            </div>

            {lastRefreshed && (
                <p className="text-xs text-gray-500">
                    Last updated {fmtTime(lastRefreshed)}
                </p>
            )}

            {/* ── Error state ── */}
            {error && (
                <div className="rounded-lg bg-red-950/40 px-3 py-2 ring-1 ring-red-500/30">
                    <p className="text-xs text-red-400">{error}</p>
                </div>
            )}

            {/* ── Empty / loading ── */}
            {!error && !roomSummary && !isLoading && (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-gray-500">
                    <LuCode2 size={32} className="opacity-40" />
                    <p className="text-sm">No data yet.</p>
                    <p className="text-xs">
                        Analytics are recorded as students join and run code.
                    </p>
                </div>
            )}

            {isLoading && !roomSummary && (
                <div className="flex justify-center py-10">
                    <LuRefreshCw size={24} className="animate-spin text-gray-500" />
                </div>
            )}

            {/* ── Dashboard content ── */}
            {roomSummary && (
                <>
                    {/* Room overview */}
                    <RoomOverview />

                    {/* Activity chart */}
                    {timeSeries && timeSeries.buckets.length > 0 && (
                        <ActivityChart ts={timeSeries} />
                    )}

                    {/* Recent runs */}
                    {roomSummary.recentRuns.length > 0 && (
                        <RecentRunsPanel runs={roomSummary.recentRuns} />
                    )}

                    {/* Students needing attention */}
                    {studentsAtRisk.length > 0 && (
                        <section>
                            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-red-400">
                                <LuAlertTriangle size={12} />
                                Needs Attention ({studentsAtRisk.length})
                            </p>
                            <div className="space-y-2">
                                {studentsAtRisk
                                    .sort((a, b) => b.errorRate - a.errorRate)
                                    .map((s) => (
                                        <StudentCard key={s.username} student={s} />
                                    ))}
                            </div>
                        </section>
                    )}

                    {/* On-track students */}
                    {studentsOk.length > 0 && (
                        <section>
                            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-green-400">
                                <LuCheckCircle2 size={12} />
                                On Track ({studentsOk.length})
                            </p>
                            <div className="space-y-2">
                                {studentsOk
                                    .sort((a, b) => b.totalRuns - a.totalRuns)
                                    .map((s) => (
                                        <StudentCard key={s.username} student={s} />
                                    ))}
                            </div>
                        </section>
                    )}

                    {roomSummary.totalStudents === 0 && (
                        <div className="flex flex-col items-center gap-2 py-8 text-center text-gray-500">
                            <LuUsers size={28} className="opacity-40" />
                            <p className="text-sm">No students have joined yet.</p>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

export default DashboardView
