import db from "./db"

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SessionRow {
	id: number
	room_id: string
	username: string
	joined_at: number
	left_at: number | null
	duration_ms: number | null
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

export interface MilestoneEventRow {
	id: number
	room_id: string
	username: string
	event_type: string
	detail: string | null
	occurred_at: number
}

// ── Student summary returned to the frontend ───────────────────────────────────

export interface StudentSummary {
	username: string
	totalSessions: number
	totalTimeMs: number
	totalRuns: number
	successfulRuns: number
	failedRuns: number
	errorRate: number           // 0–1
	topLanguages: string[]
	frequentErrors: FrequentError[]
	lastSeen: number            // Unix ms
	milestones: MilestoneSummary
}

export interface FrequentError {
	snippet: string             // first ~80 chars of error
	count: number
}

export interface MilestoneSummary {
	filesCreated: number
	chatMessages: number
	aiPrompts: number
	drawings: number
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
	lastActivity: number        // Unix ms
}

// ── Prepared statements ────────────────────────────────────────────────────────
// NOTE: @types/better-sqlite3 generic param on prepare() is the *result* row
// type, not the parameter tuple.  We omit it and cast results explicitly.

const stmtSessionStart = db.prepare(
	`INSERT INTO sessions (room_id, username, joined_at) VALUES (?, ?, ?)`,
)

// NOTE: SQLite does not support ORDER BY / LIMIT in a plain UPDATE.
// We use a subquery to target the most recent open session row.
const stmtSessionEnd = db.prepare(`
	UPDATE sessions
	SET left_at = ?, duration_ms = ?
	WHERE id = (
		SELECT id FROM sessions
		WHERE room_id = ? AND username = ? AND left_at IS NULL
		ORDER BY joined_at DESC LIMIT 1
	)
`)

const stmtInsertRun = db.prepare(
	`INSERT INTO code_runs (room_id, username, language, file_name, success, error_text, ran_at)
	 VALUES (?, ?, ?, ?, ?, ?, ?)`,
)

const stmtInsertEvent = db.prepare(
	`INSERT INTO milestone_events (room_id, username, event_type, detail, occurred_at)
	 VALUES (?, ?, ?, ?, ?)`,
)

// ── Write helpers ──────────────────────────────────────────────────────────────

export function recordSessionStart(roomId: string, username: string): void {
	try {
		stmtSessionStart.run(roomId, username, Date.now())
	} catch (err) {
		console.error("[analytics] recordSessionStart error:", err)
	}
}

export function recordSessionEnd(roomId: string, username: string): void {
	try {
		const now = Date.now()
		// Find the most recent open session to compute duration
		const row = db
			.prepare(
				`SELECT joined_at FROM sessions
				 WHERE room_id = ? AND username = ? AND left_at IS NULL
				 ORDER BY joined_at DESC LIMIT 1`,
			)
			.get(roomId, username) as { joined_at: number } | undefined

		const duration = row ? now - row.joined_at : 0
		stmtSessionEnd.run(now, duration, roomId, username)
	} catch (err) {
		console.error("[analytics] recordSessionEnd error:", err)
	}
}

export function recordCodeRun(
	roomId: string,
	username: string,
	language: string,
	fileName: string,
	success: boolean,
	errorText?: string,
): void {
	try {
		stmtInsertRun.run(
			roomId,
			username,
			language,
			fileName,
			success ? 1 : 0,
			errorText ? errorText.slice(0, 500) : null,
			Date.now(),
		)
	} catch (err) {
		console.error("[analytics] recordCodeRun error:", err)
	}
}

export function recordMilestone(
	roomId: string,
	username: string,
	eventType: "file_created" | "chat_message" | "ai_prompt" | "drawing",
	detail?: object,
): void {
	try {
		stmtInsertEvent.run(
			roomId,
			username,
			eventType,
			detail ? JSON.stringify(detail) : null,
			Date.now(),
		)
	} catch (err) {
		console.error("[analytics] recordMilestone error:", err)
	}
}

// ── Query helpers ──────────────────────────────────────────────────────────────

function buildStudentSummary(roomId: string, username: string): StudentSummary {
	// Sessions
	const sessions = db
		.prepare(`SELECT * FROM sessions WHERE room_id = ? AND username = ?`)
		.all(roomId, username) as SessionRow[]

	const totalSessions = sessions.length
	const totalTimeMs = sessions.reduce((acc, s) => acc + (s.duration_ms ?? 0), 0)
	const lastSeen = sessions.reduce(
		(acc, s) => Math.max(acc, s.left_at ?? s.joined_at),
		0,
	)

	// Code runs
	const runs = db
		.prepare(
			`SELECT * FROM code_runs WHERE room_id = ? AND username = ? ORDER BY ran_at DESC`,
		)
		.all(roomId, username) as CodeRunRow[]

	const totalRuns = runs.length
	const successfulRuns = runs.filter((r) => r.success === 1).length
	const failedRuns = totalRuns - successfulRuns
	const errorRate = totalRuns > 0 ? failedRuns / totalRuns : 0

	// Top languages
	const langCounts: Record<string, number> = {}
	for (const r of runs) langCounts[r.language] = (langCounts[r.language] ?? 0) + 1
	const topLanguages = Object.entries(langCounts)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 3)
		.map(([lang]) => lang)

	// Frequent errors — keyed by first 80 chars
	const errorCounts: Record<string, number> = {}
	for (const r of runs) {
		if (r.error_text) {
			const key = r.error_text.slice(0, 80).trim()
			errorCounts[key] = (errorCounts[key] ?? 0) + 1
		}
	}
	const frequentErrors: FrequentError[] = Object.entries(errorCounts)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([snippet, count]) => ({ snippet, count }))

	// Milestones
	const events = db
		.prepare(
			`SELECT event_type FROM milestone_events WHERE room_id = ? AND username = ?`,
		)
		.all(roomId, username) as MilestoneEventRow[]

	const milestones: MilestoneSummary = {
		filesCreated: events.filter((e) => e.event_type === "file_created").length,
		chatMessages: events.filter((e) => e.event_type === "chat_message").length,
		aiPrompts:    events.filter((e) => e.event_type === "ai_prompt").length,
		drawings:     events.filter((e) => e.event_type === "drawing").length,
	}

	return {
		username,
		totalSessions,
		totalTimeMs,
		totalRuns,
		successfulRuns,
		failedRuns,
		errorRate,
		topLanguages,
		frequentErrors,
		lastSeen,
		milestones,
	}
}

export function getRoomSummary(roomId: string): RoomSummary {
	const userRows = db
		.prepare(`SELECT DISTINCT username FROM sessions WHERE room_id = ?`)
		.all(roomId) as { username: string }[]

	const students = userRows.map((u) => buildStudentSummary(roomId, u.username))

	const totalSessions = students.reduce((a, s) => a + s.totalSessions, 0)
	const totalTimeMs   = students.reduce((a, s) => a + s.totalTimeMs, 0)
	const totalRuns     = students.reduce((a, s) => a + s.totalRuns, 0)
	const totalFailed   = students.reduce((a, s) => a + s.failedRuns, 0)
	const errorRate     = totalRuns > 0 ? totalFailed / totalRuns : 0

	const langCounts: Record<string, number> = {}
	for (const s of students)
		for (const l of s.topLanguages) langCounts[l] = (langCounts[l] ?? 0) + 1
	const topLanguages = Object.entries(langCounts)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 3)
		.map(([lang]) => lang)

	const recentRuns = db
		.prepare(
			`SELECT * FROM code_runs WHERE room_id = ? ORDER BY ran_at DESC LIMIT 20`,
		)
		.all(roomId) as CodeRunRow[]

	const lastActivity = students.reduce((a, s) => Math.max(a, s.lastSeen), 0)

	return {
		roomId,
		totalStudents: students.length,
		totalSessions,
		totalTimeMs,
		totalRuns,
		errorRate,
		topLanguages,
		students,
		recentRuns,
		lastActivity,
	}
}

export function getAllRoomIds(): string[] {
	const rows = db
		.prepare(`SELECT DISTINCT room_id FROM sessions ORDER BY room_id`)
		.all() as { room_id: string }[]
	return rows.map((r) => r.room_id)
}

// ── Time-series types & queries ────────────────────────────────────────────────

/** One bucket in a time-series chart (one hour or one day) */
export interface TimeSeriesBucket {
	ts: number            // bucket start, Unix ms
	totalRuns: number
	successRuns: number
	failedRuns: number
	sessionMs: number     // total coding time for sessions starting in this bucket
	activeStudents: number
}

/** Per-student run activity for sparklines */
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

/**
 * Returns run + session activity bucketed by hour (≤24 h span) or day (>24 h).
 * Always covers the 7-day window ending at the most recent recorded event.
 */
export function getRoomTimeSeries(roomId: string): TimeSeriesPayload {
	const lastRunRow = db
		.prepare(`SELECT MAX(ran_at) AS ts FROM code_runs WHERE room_id = ?`)
		.get(roomId) as { ts: number | null } | undefined

	const lastSessionRow = db
		.prepare(`SELECT MAX(joined_at) AS ts FROM sessions WHERE room_id = ?`)
		.get(roomId) as { ts: number | null } | undefined

	const lastTs = Math.max(lastRunRow?.ts ?? 0, lastSessionRow?.ts ?? 0)
	if (lastTs === 0) {
		return { roomId, granularity: "hour", buckets: [], perStudent: [] }
	}

	const windowMs   = 7 * 24 * 60 * 60 * 1000
	const fromTs     = lastTs - windowMs
	// Use hour buckets for sessions spanning ≤24 h, otherwise day buckets
	const granularity: "hour" | "day" = windowMs <= 24 * 60 * 60 * 1000 ? "hour" : "day"
	const bucketMs   = granularity === "hour" ? 3_600_000 : 86_400_000

	const runs = db
		.prepare(
			`SELECT * FROM code_runs WHERE room_id = ? AND ran_at >= ? ORDER BY ran_at ASC`,
		)
		.all(roomId, fromTs) as CodeRunRow[]

	const sessions = db
		.prepare(
			`SELECT * FROM sessions WHERE room_id = ? AND joined_at >= ? ORDER BY joined_at ASC`,
		)
		.all(roomId, fromTs) as SessionRow[]

	const toBucket = (ts: number) => Math.floor(ts / bucketMs) * bucketMs

	// Aggregate runs per bucket
	const runMap: Record<
		number,
		{ total: number; success: number; failed: number; students: Set<string> }
	> = {}
	for (const r of runs) {
		const b = toBucket(r.ran_at)
		if (!runMap[b]) runMap[b] = { total: 0, success: 0, failed: 0, students: new Set() }
		runMap[b].total++
		r.success === 1 ? runMap[b].success++ : runMap[b].failed++
		runMap[b].students.add(r.username)
	}

	// Aggregate session time per bucket
	const sessionMsMap: Record<number, number> = {}
	const sessionStudentsMap: Record<number, Set<string>> = {}
	for (const s of sessions) {
		const b = toBucket(s.joined_at)
		sessionMsMap[b] = (sessionMsMap[b] ?? 0) + (s.duration_ms ?? 0)
		if (!sessionStudentsMap[b]) sessionStudentsMap[b] = new Set()
		sessionStudentsMap[b].add(s.username)
	}

	// Merge all bucket keys
	const allBuckets = new Set([
		...Object.keys(runMap).map(Number),
		...Object.keys(sessionMsMap).map(Number),
	])
	const sortedBuckets = Array.from(allBuckets).sort((a, b) => a - b)

	const buckets: TimeSeriesBucket[] = sortedBuckets.map((b) => {
		const rm = runMap[b]
		const studentSet = new Set<string>([
			...(rm?.students ?? []),
			...(sessionStudentsMap[b] ?? []),
		])
		return {
			ts:             b,
			totalRuns:      rm?.total   ?? 0,
			successRuns:    rm?.success  ?? 0,
			failedRuns:     rm?.failed   ?? 0,
			sessionMs:      sessionMsMap[b] ?? 0,
			activeStudents: studentSet.size,
		}
	})

	// Per-student activity rows
	const perStudentMap: Record<string, Record<number, { runs: number; errors: number }>> = {}
	for (const r of runs) {
		const b = toBucket(r.ran_at)
		if (!perStudentMap[r.username]) perStudentMap[r.username] = {}
		if (!perStudentMap[r.username][b]) perStudentMap[r.username][b] = { runs: 0, errors: 0 }
		perStudentMap[r.username][b].runs++
		if (r.success === 0) perStudentMap[r.username][b].errors++
	}

	const perStudent: StudentActivityRow[] = []
	for (const [username, bucketData] of Object.entries(perStudentMap)) {
		for (const [ts, { runs, errors }] of Object.entries(bucketData)) {
			perStudent.push({ username, ts: Number(ts), runs, errors })
		}
	}
	perStudent.sort((a, b) => a.ts - b.ts)

	return { roomId, granularity, buckets, perStudent }
}
