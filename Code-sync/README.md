# Code-Sync

A real-time collaborative coding platform with AI mentorship, GitHub integration, multi-file project support, built-in video/audio chat, and a collaborative whiteboard — all in the browser, zero installation required.

---

## Features

### Real-Time Collaboration
- Multiple users edit the same file simultaneously with live cursor and selection sync
- File tree operations (create, rename, delete, move) broadcast instantly to all room participants
- Tabbed multi-file editing — open, switch, and close files without losing context

### Multi-File Project Support
- Full VS Code-style file explorer with nested directories
- Import any project as a ZIP — the entire tree loads into the collaborative workspace
- Download the current workspace as a ZIP at any time
- Pre-loaded demo files for JavaScript, Python, C, and C++ on every room join

### GitHub Integration
- Sign in with GitHub using the OAuth Device Flow — no passwords, no redirects
- Import any public or private repository directly into the collaborative workspace
- Edit files with your team, then push a single commit back to the remote branch
- Full diff preview before pushing; sensitive file detection to prevent accidental leaks

### AI Rubber Duck Mentor
- Select any block of code and ask the AI a question about it
- Uses the Socratic method — asks guiding questions rather than giving direct answers
- Maintains a conversation thread scoped to the selected code snippet
- Powered by Groq (llama model) with Pollinations AI as a fallback

### Code Execution
- Run code in 10+ languages via the Piston API (Python, JavaScript, C, C++, Go, Rust, Java, and more)
- Stdin support for interactive programs
- Output panel with error highlighting

### Built-in Video and Audio Chat
- Peer-to-peer WebRTC video/audio — no third-party meeting app needed
- Mute, camera toggle, and per-participant controls
- Works alongside the editor — no tab switching

### Voice to Code
- Dictate code directly into the editor using the Web Speech API
- Supports punctuation, symbols, indentation commands, and newlines

### Collaborative Whiteboard
- Shared TLDraw canvas for diagramming and algorithm visualization
- Syncs in real-time across all participants in the room

### Collaborative AI Prompt
- Team members co-author an AI prompt together in real-time
- Link code blocks from the editor directly into the prompt
- Submit as a group and share the AI response across the room

### Analytics Dashboard
- Per-room activity metrics: code runs, file operations, chat messages, milestones
- Time-series charts showing collaboration activity over a session
- Language breakdown and error rate tracking

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 + TypeScript | UI framework |
| Vite | Build tool and dev server |
| CodeMirror 6 | Code editor |
| Socket.IO Client | Real-time sync |
| TLDraw | Collaborative whiteboard |
| TailwindCSS | Styling |
| React Router | Navigation |
| Recharts | Analytics charts |
| JSZip | ZIP import/export |

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express | HTTP server |
| Socket.IO | WebSocket server |
| TypeScript | Type safety |
| better-sqlite3 | Analytics database |
| dotenv | Environment config |

### External Services
| Service | Purpose |
|---|---|
| Piston API | Multi-language code execution |
| GitHub OAuth | Repository authentication |
| GitHub REST API | Repository import and push |
| Groq API | AI mentor (primary) |
| Pollinations AI | AI mentor (fallback) |
| WebRTC | Peer-to-peer video/audio |
| Web Speech API | Voice to code |

---

## Project Structure

```
Code-sync/
├── frontend/
│   ├── src/
│   │   ├── api/            # Piston, GitHub, AI API clients
│   │   ├── components/
│   │   │   ├── ai/         # Rubber Duck Mentor UI
│   │   │   ├── editor/     # CodeMirror editor, tabs, breadcrumb
│   │   │   ├── files/      # File tree, search, ZIP import
│   │   │   ├── sidebar/    # All sidebar panel views
│   │   │   └── drawing/    # TLDraw whiteboard
│   │   ├── context/        # React context providers
│   │   ├── styles/         # CSS files per feature
│   │   ├── types/          # TypeScript interfaces
│   │   └── utils/          # File utilities, demo files, templates
│   └── package.json
│
└── backend/
    ├── src/
    │   ├── server.ts       # Express + Socket.IO server
    │   ├── github.ts       # GitHub OAuth and proxy routes
    │   └── analytics/      # SQLite queries and DB setup
    └── package.json
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/code-sync.git
cd code-sync
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
PORT=3000

# Required for AI mentor (free tier at console.groq.com)
GROQ_API_KEY=your_groq_api_key

# Required for GitHub integration
# Create an OAuth App at github.com/settings/developers
# Callback URL: http://localhost:3000/api/github/callback
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Comma-separated list of allowed frontend origins
GITHUB_ALLOWED_ORIGINS=http://localhost:5173
```

Start the backend:

```bash
npm run dev
# Listening on port 3000
```

### 3. Frontend Setup

```bash
cd ../frontend
npm install
```

Create `frontend/.env`:

```env
VITE_BACKEND_URL=http://localhost:3000
```

Start the frontend:

```bash
npm run dev
# Running at http://localhost:5173
```

### 4. Open in Browser

Go to `http://localhost:5173`, create a room, and share the room ID with collaborators.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: 3000) |
| `GROQ_API_KEY` | No | Groq API key for AI mentor. Falls back to Pollinations if unset |
| `GITHUB_CLIENT_ID` | Yes* | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | Yes* | GitHub OAuth App client secret |
| `GITHUB_ALLOWED_ORIGINS` | No | Comma-separated allowed frontend origins |

*Required only if you want GitHub integration

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_BACKEND_URL` | Yes | Backend server URL |

---

## GitHub OAuth Setup

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Click **OAuth Apps** → **New OAuth App**
3. Fill in:
   - **Application name:** Code-Sync
   - **Homepage URL:** `http://localhost:5173`
   - **Authorization callback URL:** `http://localhost:3000/api/github/callback`
4. Copy the **Client ID** and generate a **Client Secret**
5. Add both to `backend/.env`

---

## Usage

### Joining a Room
- Enter your username and a room ID on the landing page
- Share the room ID with collaborators
- Everyone who joins the same ID enters the same collaborative workspace

### Running Code
- Open a file in the editor
- Select a language from the dropdown (top right)
- Click **Run Code**
- Output appears in the panel below the editor

### Using the AI Mentor
- Write some code in the editor
- Select (highlight) the code you want help with
- Click **Ask mentor** that appears at the bottom right
- Type your question and press Enter
- The AI will guide you with questions, not answers

### Importing from GitHub
- Click the **GitHub** tab in the left sidebar
- Click **Sign in with GitHub**
- Complete the device flow (visit the link and enter the code)
- Enter a repository URL or `owner/repo` and click **Import**
- Edit collaboratively, then click **Push Changes** to commit back

### Importing a ZIP Project
- Click the **Files** tab in the left sidebar
- Click **Import ZIP** at the bottom
- Select a `.zip` file from your computer
- The entire project tree loads into the workspace

---

## Demo Files

Every room starts with four ready-to-run demo files:

| File | Language | Demonstrates |
|---|---|---|
| `demo.js` | JavaScript | Functions, console output |
| `demo.py` | Python | List operations, comprehensions, methods |
| `demo.c` | C | Arrays, loops, recursion, factorial |
| `demo.cpp` | C++ | Classes, vectors, OOP, range-based loops |

---

## Scripts

### Backend
```bash
npm run dev      # Start with nodemon (hot reload)
npm run build    # Compile TypeScript
npm start        # Run compiled output
```

### Frontend
```bash
npm run dev      # Start Vite dev server
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "Add my feature"`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## License

MIT
