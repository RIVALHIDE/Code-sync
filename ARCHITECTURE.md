# Code-Sync Architecture Documentation

## Table of Contents
- [System Overview](#system-overview)
- [Architecture Diagram](#architecture-diagram)
- [Technology Stack](#technology-stack)
- [System Components](#system-components)
- [Data Flow](#data-flow)
- [Real-Time Communication](#real-time-communication)
- [State Management](#state-management)
- [API Structure](#api-structure)
- [Database Schema](#database-schema)
- [Security Considerations](#security-considerations)
- [Deployment Architecture](#deployment-architecture)

---

## System Overview

Code-Sync is a **real-time collaborative code editor** with integrated communication, AI assistance, code execution, and analytics. The platform enables multiple users to code together in synchronized rooms with live cursors, video/audio chat, shared whiteboards, and instant code execution.

### Core Capabilities
- **Multi-user collaborative editing** with live cursor tracking
- **WebRTC-based video and audio conferencing**
- **AI-powered code assistance** (Copilot & Pedagogical AI)
- **Sandboxed code execution** via Piston API
- **Real-time analytics** for learning insights
- **Integrated whiteboard** using tldraw
- **File tree management** with CRUD operations
- **Session recording and playback**

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                         │
├─────────────────────────────────────────────────────────────────┤
│  React App (TypeScript + Vite)                                  │
│  ├── Pages (Home, Editor)                                       │
│  ├── Components (Sidebar, Workspace, Forms, Video, Chat)        │
│  ├── Context Providers (15 contexts for state management)       │
│  ├── Monaco Editor (CodeMirror integration)                     │
│  └── Socket.IO Client                                           │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ WebSocket + HTTP/HTTPS
             │
┌────────────▼────────────────────────────────────────────────────┐
│                    BACKEND SERVER (Node.js)                      │
├─────────────────────────────────────────────────────────────────┤
│  Express.js + TypeScript                                        │
│  ├── Socket.IO Server (Real-time events)                       │
│  ├── REST API Endpoints                                         │
│  │   ├── /api/ai/chat (AI proxy: Groq → Pollinations)         │
│  │   ├── /api/analytics/run (Code execution logging)           │
│  │   ├── /api/analytics/rooms (Room list)                      │
│  │   └── /api/analytics/rooms/:roomId (Dashboard data)         │
│  ├── Analytics Module (Better-SQLite3)                         │
│  └── In-Memory State                                            │
│      ├── userSocketMap: User[] (Active connections)            │
│      └── activeCallParticipants: Map<roomId, Set<socketId>>   │
└────────────┬────────────────────────────────────────────────────┘
             │
             ├─── SQLite Database (analytics.db)
             │    ├── sessions (User sessions)
             │    ├── code_runs (Execution logs)
             │    └── milestone_events (Activity tracking)
             │
             ├─── External: Piston API (Code execution)
             │    └── https://emkc.org/api/v2/piston/execute
             │
             └─── External: AI APIs
                  ├── Groq API (Primary - openai/gpt-oss-20b)
                  └── Pollinations API (Fallback - openai-fast)
```

---

## Technology Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 18** | UI framework |
| **TypeScript** | Type safety |
| **Vite** | Build tool & dev server |
| **Tailwind CSS** | Styling framework |
| **Framer Motion** | Animations |
| **Socket.IO Client** | Real-time communication |
| **CodeMirror** | Code editor (via @uiw/react-codemirror) |
| **React Router** | Client-side routing |
| **React Hot Toast** | Notifications |
| **tldraw** | Collaborative whiteboard |
| **Recharts** | Analytics visualizations |
| **Axios** | HTTP client |

### Backend
| Technology | Purpose |
|------------|---------|
| **Node.js** | Runtime environment |
| **Express.js** | HTTP server |
| **TypeScript** | Type safety |
| **Socket.IO** | WebSocket server |
| **Better-SQLite3** | Embedded database |
| **CORS** | Cross-origin resource sharing |
| **dotenv** | Environment configuration |

### External Services
- **Piston API**: Sandboxed code execution (50+ languages)
- **Groq API**: Primary AI model (GPT-based)
- **Pollinations API**: Fallback AI service

---

## System Components

### Frontend Architecture

```
src/
├── pages/
│   ├── HomePage.tsx          # Landing page with room join form
│   └── EditorPage.tsx        # Main collaborative workspace
│
├── components/
│   ├── forms/                # Form components
│   ├── sidebar/              # Tool navigation and panels
│   ├── workspace/            # Editor, tabs, file tree
│   ├── video/                # WebRTC video call UI
│   ├── chats/                # Group chat component
│   ├── drawing/              # tldraw integration
│   ├── ai/                   # AI Copilot UI
│   ├── files/                # File explorer tree
│   ├── recording/            # Session recording
│   └── common/               # Shared UI components
│
├── context/                  # React Context providers
│   ├── AppProvider.tsx       # Root provider (nests all contexts)
│   ├── SocketContext.tsx     # Socket.IO connection
│   ├── AppContext.tsx        # Global app state
│   ├── FileContext.tsx       # File tree state
│   ├── ChatContext.tsx       # Chat messages
│   ├── VideoCallContext.tsx  # WebRTC peer connections
│   ├── CopilotContext.tsx    # AI assistant state
│   ├── CoPromptContext.tsx   # Collaborative AI prompting
│   ├── RunCodeContext.tsx    # Code execution state
│   ├── SettingContext.tsx    # User preferences
│   ├── ViewContext.tsx       # Sidebar view management
│   ├── RecordingContext.tsx  # Session recording
│   ├── VoiceContext.tsx      # Voice call state
│   ├── PedagogicalAIContext.tsx  # Error explanation AI
│   └── AnalyticsContext.tsx  # Dashboard data
│
├── api/
│   ├── aiApi.ts              # AI chat proxy
│   ├── pistonApi.ts          # Code execution API
│   └── pollinationsApi.ts    # Fallback AI service
│
├── types/                    # TypeScript type definitions
│   ├── socket.ts             # Socket event types
│   ├── user.ts               # User data structures
│   ├── file.ts               # File tree types
│   ├── chat.ts               # Chat message types
│   ├── videoCall.ts          # WebRTC types
│   ├── copilot.ts            # AI types
│   ├── coPrompt.ts           # Collaborative prompting
│   ├── run.ts                # Code execution types
│   └── ...
│
└── hooks/                    # Custom React hooks
    ├── useFullScreen.ts
    ├── useWindowDimensions.ts
    └── useUserActivity.ts
```

### Backend Architecture

```
src/
├── server.ts                 # Main server file
│   ├── Express app setup
│   ├── Socket.IO server initialization
│   ├── REST API routes
│   ├── Socket event handlers
│   └── Server startup
│
├── analytics/
│   ├── db.ts                 # SQLite database connection
│   ├── queries.ts            # Analytics queries
│   └── schema.sql            # Database schema
│
└── types/
    ├── socket.ts             # Socket event types
    └── user.ts               # User types
```

---

## Data Flow

### 1. User Connection Flow

```
User opens app
     ↓
HomePage (Enter username + roomId)
     ↓
Socket.emit(JOIN_REQUEST, { username, roomId })
     ↓
Backend validates username uniqueness
     ↓
Backend emits:
  - JOIN_ACCEPTED → Joining user (with user list)
  - USER_JOINED → Other room members
     ↓
Navigate to /editor/:roomId
     ↓
EditorPage loads with all contexts initialized
```

### 2. Code Editing Flow

```
User types in Monaco Editor
     ↓
FileContext updates local state
     ↓
Socket.emit(FILE_UPDATED, { fileId, newContent })
     ↓
Backend broadcasts to room:
  Socket.broadcast.to(roomId).emit(FILE_UPDATED)
     ↓
Other users receive update
     ↓
Their FileContext updates local file tree
     ↓
Monaco Editor re-renders with new content
```

### 3. Live Cursor Flow

```
User moves cursor or selects text
     ↓
Editor onChange handler
     ↓
Socket.emit(TYPING_START, { cursorPosition, selectionStart, selectionEnd })
     ↓
Backend updates userSocketMap
     ↓
Backend broadcasts to room
     ↓
Other users render cursor overlays in Monaco Editor
```

### 4. Code Execution Flow

```
User clicks "Run Code"
     ↓
RunCodeContext.executeCode()
     ↓
POST /api/v2/piston/execute (Piston API)
  - Send code + language + input
     ↓
Receive execution result (output/errors)
     ↓
POST /api/analytics/run (Log execution)
     ↓
Display output in terminal panel
```

### 5. Video Call Flow (WebRTC)

```
User A joins call
     ↓
Socket.emit(VIDEO_CALL_USER_JOINED)
     ↓
Backend adds to activeCallParticipants
     ↓
Backend sends participant list to User A
     ↓
User A creates RTCPeerConnection for each participant
     ↓
User A creates offer
     ↓
Socket.emit(VIDEO_CALL_OFFER, { targetSocketId, offer })
     ↓
User B receives offer
     ↓
User B creates answer
     ↓
Socket.emit(VIDEO_CALL_ANSWER, { targetSocketId, answer })
     ↓
ICE candidates exchanged via VIDEO_CALL_ICE_CANDIDATE
     ↓
Direct P2P connection established
     ↓
Video/audio streams flow between peers
```

---

## Real-Time Communication

### Socket.IO Events

#### Connection Events
| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `JOIN_REQUEST` | Client → Server | `{ roomId, username }` | Request to join room |
| `JOIN_ACCEPTED` | Server → Client | `{ user, users }` | Successful join confirmation |
| `USER_JOINED` | Server → Clients | `{ user }` | Notify others of new user |
| `USER_DISCONNECTED` | Server → Clients | `{ user }` | User left room |
| `USERNAME_EXISTS` | Server → Client | - | Username taken error |

#### File Operations
| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `SYNC_FILE_STRUCTURE` | Bidirectional | `{ fileStructure, openFiles, activeFile }` | Sync file tree |
| `FILE_CREATED` | Client → Server → Clients | `{ parentDirId, newFile }` | New file created |
| `FILE_UPDATED` | Client → Server → Clients | `{ fileId, newContent }` | File content changed |
| `FILE_RENAMED` | Client → Server → Clients | `{ fileId, newName }` | File renamed |
| `FILE_DELETED` | Client → Server → Clients | `{ fileId }` | File deleted |
| `DIRECTORY_CREATED` | Client → Server → Clients | `{ parentDirId, newDirectory }` | New folder |
| `DIRECTORY_RENAMED` | Client → Server → Clients | `{ dirId, newName }` | Folder renamed |
| `DIRECTORY_DELETED` | Client → Server → Clients | `{ dirId }` | Folder deleted |

#### Cursor & Typing
| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `TYPING_START` | Client → Server → Clients | `{ cursorPosition, selectionStart, selectionEnd }` | User typing |
| `TYPING_PAUSE` | Client → Server → Clients | `{ user }` | User stopped typing |
| `CURSOR_MOVE` | Client → Server → Clients | `{ cursorPosition, selectionStart, selectionEnd }` | Cursor movement |

#### Chat
| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `SEND_MESSAGE` | Client → Server | `{ message }` | Send chat message |
| `RECEIVE_MESSAGE` | Server → Clients | `{ message }` | Receive chat message |

#### Whiteboard
| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `REQUEST_DRAWING` | Client → Server → Client | `{ socketId }` | Request board sync |
| `SYNC_DRAWING` | Client → Client | `{ drawingData }` | Send board state |
| `DRAWING_UPDATE` | Client → Server → Clients | `{ snapshot }` | Board updated |

#### Collaborative AI Prompting
| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `CO_PROMPT_UPDATE` | Client → Server → Clients | `{ text }` | Shared prompt text |
| `CO_PROMPT_CURSOR` | Client → Server → Clients | `{ cursor }` | Cursor in prompt |
| `CO_PROMPT_LINK_CODE` | Client → Server → Clients | `{ block }` | Link code block |
| `CO_PROMPT_UNLINK_CODE` | Client → Server → Clients | `{ id }` | Unlink code |
| `CO_PROMPT_SUBMIT` | Client → Server → Clients | `{ submittedBy }` | Submit prompt |
| `CO_PROMPT_RESPONSE` | Client → Server → Clients | `{ response, entry }` | AI response |
| `CO_PROMPT_CLEAR` | Client → Server → Clients | - | Clear prompt |

#### Video Call (WebRTC Signaling)
| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `VIDEO_CALL_USER_JOINED` | Client → Server → Clients | `{ username }` | User joined call |
| `VIDEO_CALL_PARTICIPANTS_LIST` | Server → Client | `{ participants }` | Current participants |
| `VIDEO_CALL_OFFER` | Client → Server → Client | `{ targetSocketId, offer }` | WebRTC offer |
| `VIDEO_CALL_ANSWER` | Client → Server → Client | `{ targetSocketId, answer }` | WebRTC answer |
| `VIDEO_CALL_ICE_CANDIDATE` | Client → Server → Client | `{ targetSocketId, candidate }` | ICE candidate |
| `VIDEO_CALL_USER_LEFT` | Client/Server → Clients | `{ socketId }` | User left call |
| `VIDEO_CALL_MUTE_TOGGLE` | Client → Server → Clients | `{ isMuted }` | Muted/unmuted |
| `VIDEO_CALL_VIDEO_TOGGLE` | Client → Server → Clients | `{ isVideoOff }` | Video on/off |

---

## State Management

### Context Hierarchy

The app uses a nested Context Provider pattern with 15 specialized contexts:

```tsx
AppProvider (Root)
  └─ AppContextProvider (Global state)
      └─ SocketProvider (Socket.IO connection)
          └─ SettingContextProvider (User settings)
              └─ ViewContextProvider (Sidebar views)
                  └─ FileContextProvider (File tree)
                      └─ CopilotContextProvider (AI assistant)
                          └─ RunCodeContextProvider (Code execution)
                              └─ PedagogicalAIContextProvider (Error AI)
                                  └─ RecordingContextProvider (Sessions)
                                      └─ CoPromptContextProvider (Collab AI)
                                          └─ VoiceContextProvider (Voice calls)
                                              └─ ChatContextProvider (Chat)
                                                  └─ VideoCallContextProvider (Video)
                                                      └─ AnalyticsContextProvider (Stats)
```

### Key State Objects

**AppContext**
```typescript
{
  currentUser: User,
  status: USER_STATUS,
  activityState: ACTIVITY_STATE (CODING | DRAWING),
  setCurrentUser: Function,
  setStatus: Function,
  setActivityState: Function
}
```

**FileContext**
```typescript
{
  fileStructure: FileSystemItem[],
  openFiles: FileType[],
  activeFile: FileType | null,
  createFile: Function,
  updateFile: Function,
  deleteFile: Function,
  // ... CRUD operations
}
```

**SocketContext**
```typescript
{
  socket: Socket | null,
  isConnected: boolean
}
```

**VideoCallContext**
```typescript
{
  localStream: MediaStream | null,
  peerConnections: Map<string, RTCPeerConnection>,
  remoteStreams: Map<string, MediaStream>,
  isMuted: boolean,
  isVideoOff: boolean,
  participants: User[],
  joinCall: Function,
  leaveCall: Function,
  toggleMute: Function,
  toggleVideo: Function
}
```

---

## API Structure

### REST Endpoints

#### AI Proxy
```http
POST /api/ai/chat
Content-Type: application/json

Request:
{
  "messages": [
    { "role": "system", "content": "You are a helpful assistant" },
    { "role": "user", "content": "Explain recursion" }
  ]
}

Response:
{
  "content": "Recursion is a programming technique..."
}

Strategy:
1. Try Groq API (primary, requires GROQ_API_KEY env var)
2. Fallback to Pollinations (free, no key required)
3. Return 502 if both fail
```

#### Analytics

```http
POST /api/analytics/run
Content-Type: application/json

Request:
{
  "roomId": "abc-123",
  "username": "john_doe",
  "language": "python",
  "fileName": "main.py",
  "success": true,
  "errorText": null
}

Response:
{ "ok": true }
```

```http
GET /api/analytics/rooms
Response:
{
  "rooms": ["room-1", "room-2", "room-3"]
}
```

```http
GET /api/analytics/rooms/:roomId
Response:
{
  "roomId": "abc-123",
  "totalStudents": 3,
  "totalSessions": 5,
  "totalTimeMs": 3600000,
  "totalRuns": 42,
  "errorRate": 0.15,
  "topLanguages": ["python", "javascript", "cpp"],
  "students": [
    {
      "username": "alice",
      "totalSessions": 2,
      "totalTimeMs": 1800000,
      "totalRuns": 20,
      "successfulRuns": 18,
      "failedRuns": 2,
      "errorRate": 0.1,
      "topLanguages": ["python", "javascript"],
      "frequentErrors": [
        { "snippet": "NameError: name 'x' is not defined", "count": 3 }
      ],
      "lastSeen": 1700000000000,
      "milestones": {
        "filesCreated": 5,
        "chatMessages": 12,
        "aiPrompts": 3,
        "drawings": 1
      }
    },
    // ... more students
  ],
  "recentRuns": [/* ... */],
  "lastActivity": 1700000000000
}
```

```http
GET /api/analytics/rooms/:roomId/timeseries
Response:
{
  "roomId": "abc-123",
  "granularity": "hour",
  "buckets": [
    {
      "ts": 1700000000000,
      "totalRuns": 10,
      "successRuns": 8,
      "failedRuns": 2,
      "sessionMs": 3600000,
      "activeStudents": 2
    },
    // ... more buckets (7-day window)
  ],
  "perStudent": [
    {
      "username": "alice",
      "ts": 1700000000000,
      "runs": 5,
      "errors": 1
    },
    // ... more activity rows
  ]
}
```

### External APIs

#### Piston API (Code Execution)
```http
POST https://emkc.org/api/v2/piston/execute
Content-Type: application/json

Request:
{
  "language": "python",
  "version": "3.10",
  "files": [
    {
      "name": "main.py",
      "content": "print('Hello World')"
    }
  ],
  "stdin": "",
  "args": []
}

Response:
{
  "run": {
    "stdout": "Hello World\n",
    "stderr": "",
    "code": 0,
    "signal": null,
    "output": "Hello World\n"
  }
}
```

---

## Database Schema

### SQLite Tables (Better-SQLite3)

#### sessions
Tracks user session duration in rooms.

```sql
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  username TEXT NOT NULL,
  joined_at INTEGER NOT NULL,  -- Unix timestamp (ms)
  left_at INTEGER,              -- Unix timestamp (ms), NULL if active
  duration_ms INTEGER           -- Computed: left_at - joined_at
);

CREATE INDEX idx_sessions_room ON sessions(room_id);
CREATE INDEX idx_sessions_user ON sessions(room_id, username);
```

#### code_runs
Logs every code execution attempt.

```sql
CREATE TABLE code_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  username TEXT NOT NULL,
  language TEXT NOT NULL,
  file_name TEXT NOT NULL,
  success INTEGER NOT NULL,    -- 1 = success, 0 = error
  error_text TEXT,              -- First 500 chars of error
  ran_at INTEGER NOT NULL       -- Unix timestamp (ms)
);

CREATE INDEX idx_runs_room ON code_runs(room_id);
CREATE INDEX idx_runs_user ON code_runs(room_id, username);
CREATE INDEX idx_runs_time ON code_runs(ran_at);
```

#### milestone_events
Tracks significant user actions.

```sql
CREATE TABLE milestone_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  username TEXT NOT NULL,
  event_type TEXT NOT NULL,     -- 'file_created', 'chat_message', 'ai_prompt', 'drawing'
  detail TEXT,                   -- JSON string with extra data
  occurred_at INTEGER NOT NULL   -- Unix timestamp (ms)
);

CREATE INDEX idx_events_room ON milestone_events(room_id);
CREATE INDEX idx_events_type ON milestone_events(event_type);
```

---

## Security Considerations

### 1. **Socket Authentication**
- Users must provide a username + roomId to join
- Backend validates username uniqueness per room
- No password-based authentication (trust-based collaboration)

### 2. **Code Execution Sandboxing**
- All code runs in isolated Docker containers via Piston API
- No direct access to host filesystem
- Execution timeout limits prevent infinite loops

### 3. **CORS Configuration**
- Backend accepts connections from any origin (`origin: "*"`)
- **⚠️ Production recommendation**: Restrict to specific frontend domain

### 4. **Environment Variables**
```bash
# backend/.env
PORT=3000                        # Server port
GROQ_API_KEY=sk-...             # AI API key (optional)
```

### 5. **WebRTC Security**
- Peer-to-peer connections (no media passes through server)
- STUN/TURN servers for NAT traversal
- **Note**: No end-to-end encryption (WebRTC native security only)

### 6. **SQL Injection Protection**
- All queries use prepared statements (Better-SQLite3)
- No raw SQL string concatenation

### 7. **Input Validation**
- Frontend validates form inputs (username/roomId length)
- Backend validates socket event payloads

---

## Deployment Architecture

### Development Environment

```
Frontend: http://localhost:5173 (Vite dev server)
Backend:  http://localhost:3000 (Express server)

Socket.IO: ws://localhost:3000
```

### Docker Deployment

```yaml
# docker-compose.yml
services:
  server:
    container: code-sync-server
    ports: ["3000:3000"]
    volumes: ["./backend:/app"]
    
  client:
    container: code-sync-client
    ports: ["5173:5173"]
    volumes: ["./frontend:/app"]
    depends_on: [server]
```

### Production Recommendations

```
Frontend: Static build (npm run build) → CDN/Nginx
Backend:  Node.js server → PM2/Docker → Load Balancer

Database: SQLite → PostgreSQL/MongoDB (for scalability)
Socket.IO: Add Redis adapter for horizontal scaling
WebRTC: Deploy TURN server for reliable NAT traversal
```

---

## Performance Optimizations

### Frontend
- **Code splitting**: React.lazy() for heavy components
- **Debounced typing events**: 300ms delay before emitting
- **Virtual scrolling**: Large file trees use virtualization
- **Memoization**: useMemo/useCallback for expensive computations

### Backend
- **In-memory state**: User map for O(1) lookups
- **Prepared statements**: Pre-compiled SQL queries
- **Broadcast optimization**: Room-based socket emissions
- **Connection pooling**: Socket.IO manages connections efficiently

---

## Monitoring & Logging

### Frontend
- React Hot Toast for user-facing notifications
- Console logs for development
- Error boundaries for crash prevention

### Backend
- Console logs for socket events
- SQL query logging (optional)
- Error logging for AI API failures

### Analytics
- SQLite database tracks:
  - Session duration per user
  - Code execution results
  - Milestone events (files, chats, AI prompts, drawings)

---

## Future Enhancements

1. **Authentication**: Add OAuth (GitHub, Google)
2. **Permissions**: Role-based access (admin, editor, viewer)
3. **Persistence**: Save rooms to database (currently in-memory)
4. **Notifications**: Email/Slack alerts for mentors
5. **Scalability**: Redis adapter for multi-server Socket.IO
6. **Mobile**: React Native app
7. **Offline Mode**: WebAssembly-based code execution
8. **Version Control**: Git integration for projects

---

## Development Guidelines

### Adding a New Feature

1. **Define types** in `src/types/`
2. **Create context** (if state needed) in `src/context/`
3. **Add socket events** in backend `server.ts` and frontend `SocketContext`
4. **Build UI components** in `src/components/`
5. **Update AppProvider** to nest new context
6. **Write documentation** in this file

### Code Style
- **TypeScript**: Strict mode enabled
- **Linting**: ESLint + Prettier
- **Naming**: camelCase for variables, PascalCase for components
- **Comments**: JSDoc for complex functions

---

## Contact & Contribution

For questions or contributions, see the main README.md.

**Last Updated**: 2025-01-01  
**Version**: 1.0
