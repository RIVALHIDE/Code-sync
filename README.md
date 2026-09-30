# Code Sync

A collaborative, real-time code editor where users can seamlessly code together. It provides a platform for multiple users to enter a room, share a unique room ID, and collaborate on code simultaneously.

## 🔮 Features

- 💻 Real-time collaboration on code editing across multiple files
- 📁 Create, open, edit, save, delete, and organize files and folders
- 💾 Option to download the entire codebase as a zip file
- 🚀 Unique room generation with room ID for collaboration
- 🌍 Comprehensive language support for versatile programming
- 🌈 Syntax highlighting for various file types with auto-language detection
- 🚀 Code Execution: Users can execute the code directly within the collaboration environment
- ⏱️ Instant updates and synchronization of code changes across all files and folders
- 📣 Notifications for user join and leave events
- 👥 User presence list with online/offline status indicators
- 💬 Real-time group chatting functionality
- 🎩 Real-time tooltip displaying users currently editing
- 🖊 Showing real-time selection of what each user has currently selected
- 💡 Auto-suggestion based on programming language
- 🔠 Option to change font size and font family
- 🎨 Multiple themes for personalized coding experience
- 🎨 Collaborative Drawing: Enable users to draw and sketch collaboratively in real-time
- 🤖 Copilot: An AI-powered assistant that generates code, allowing you to insert, copy, or replace content seamlessly within your files

## 💻 Tech Stack

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![React Router](https://img.shields.io/badge/React_Router-CA4245?style=for-the-badge&logo=react-router&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![NodeJS](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![ExpressJS](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)
![Socket io](https://img.shields.io/badge/Socket.io-ffffff?style=for-the-badge)
![Git](https://img.shields.io/badge/GIT-E44C30?style=for-the-badge&logo=git&logoColor=white)
![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

## ⚙️ Setup

### Prerequisites

- Node.js 18+
- Docker (for Piston code execution)

### 1. Clone

```bash
git clone https://github.com/<your-username>/Code-Sync.git
cd Code-Sync
```

### 2. Environment variables

**`frontend/.env`**
```bash
VITE_BACKEND_URL=http://localhost:3000
VITE_PISTON_API_URL=/piston/api/v2
```

**`backend/.env`**
```bash
PORT=3000
```

### 3. Start the Piston code execution engine

```bash
docker run -d \
  --name piston_api \
  -p 2000:2000 \
  ghcr.io/engineer-man/piston
```

Wait ~10 seconds, then install the language runtimes you need:

```bash
# Using the Piston CLI
node index.js ppman install python
node index.js ppman install node
node index.js ppman install gcc
```

Verify installed runtimes:

```bash
curl http://localhost:2000/api/v2/runtimes
```

### 4. Install dependencies

```bash
cd frontend && npm install
cd ../backend && npm install
```

### 5. Start the servers

In two separate terminals:

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

### 6. Open

```
http://localhost:5173
```

## 🌟 Appreciation for Resources

Special thanks to:

- EMKC for providing the Piston API:
  - [Piston Repository](https://github.com/engineer-man/piston)
  - [Piston Docs](https://piston.readthedocs.io/en/latest/api-v2/)

- Tldraw contributors:
  - [Tldraw Repository](https://github.com/tldraw/tldraw)
  - [Tldraw Documentation](https://tldraw.dev/)

- Pollinations AI:
  - [Pollinations Repository](https://github.com/pollinations/pollinations)
  - [Pollinations Docs](https://pollinations.ai/)
