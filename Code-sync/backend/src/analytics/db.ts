import Database from "better-sqlite3"
import path from "path"
import fs from "fs"

// Store the DB file next to the compiled output so it persists across restarts
const DB_DIR = path.join(__dirname, "..", "..", "data")
const DB_PATH = path.join(DB_DIR, "analytics.db")

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
	fs.mkdirSync(DB_DIR, { recursive: true })
}

const db = new Database(DB_PATH)

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL")
db.pragma("foreign_keys = ON")

// ── Schema ─────────────────────────────────────────────────────────────────────
//
// sessions      — one row per user per room visit (join → leave)
// code_runs     — one row per code execution attempt
// milestone_events — discrete events: file_created, ai_prompt, chat_message, etc.
//

db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id     TEXT    NOT NULL,
        username    TEXT    NOT NULL,
        joined_at   INTEGER NOT NULL,   -- Unix ms
        left_at     INTEGER,            -- NULL while still in room
        duration_ms INTEGER             -- filled on leave
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_room    ON sessions(room_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(username);
    CREATE INDEX IF NOT EXISTS idx_sessions_joined  ON sessions(joined_at);

    CREATE TABLE IF NOT EXISTS code_runs (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id     TEXT    NOT NULL,
        username    TEXT    NOT NULL,
        language    TEXT    NOT NULL,
        file_name   TEXT    NOT NULL,
        success     INTEGER NOT NULL,   -- 1 = stdout only, 0 = stderr present
        error_text  TEXT,               -- first 500 chars of stderr if failed
        ran_at      INTEGER NOT NULL    -- Unix ms
    );

    CREATE INDEX IF NOT EXISTS idx_runs_room     ON code_runs(room_id);
    CREATE INDEX IF NOT EXISTS idx_runs_user     ON code_runs(username);
    CREATE INDEX IF NOT EXISTS idx_runs_language ON code_runs(language);
    CREATE INDEX IF NOT EXISTS idx_runs_ran_at   ON code_runs(ran_at);

    CREATE TABLE IF NOT EXISTS milestone_events (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id     TEXT    NOT NULL,
        username    TEXT    NOT NULL,
        event_type  TEXT    NOT NULL,   -- 'file_created' | 'chat_message' | 'ai_prompt' | 'drawing'
        detail      TEXT,               -- optional JSON payload
        occurred_at INTEGER NOT NULL    -- Unix ms
    );

    CREATE INDEX IF NOT EXISTS idx_events_room ON milestone_events(room_id);
    CREATE INDEX IF NOT EXISTS idx_events_user ON milestone_events(username);
    CREATE INDEX IF NOT EXISTS idx_events_type ON milestone_events(event_type);
`)

export default db
