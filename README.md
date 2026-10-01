# Code-Sync

Code-Sync is a collaborative coding platform designed to help students
learn programming together with real-time collaboration, communication,
AI assistance, code execution, and learning analytics.

## Core Platform Features

### 1. Real-Time Collaborative Editing
Synchronized multi-user coding using Socket.IO and the Monaco Editor,
allowing multiple students to work together in the same coding room.

### 2. Integrated Video & Audio Chat
Peer-to-peer WebRTC communication is integrated directly into the
coding workspace, allowing students to communicate without switching
to external meeting applications.

### 3. Secure Sandboxed Code Execution
Code execution is designed around the Dockerized Piston API, allowing
students to execute supported programming languages such as Python,
C++, and JavaScript in an isolated environment.

### 4. Pedagogical AI Assistant
An AI-assisted coding helper analyzes compiler and runtime errors and
provides plain-English explanations and step-by-step hints to help
students understand and solve programming problems.

### 5. Personalized Progress Dashboard
A MongoDB-backed analytics layer is being integrated to track student
coding activity, execution results, milestones, and frequent errors.
This data can be used to provide educators with meaningful insights
into student progress.

### 6. Automated Code Quality Linting
Real-time code analysis and formatting support help students identify
coding issues and follow better programming practices while writing code.

---

## Future Scope & Roadmap

### 1. True Offline Compilation
Integrate WebAssembly (Wasm) so supported languages can run directly
in the browser when internet connectivity is unavailable.

### 2. Multi-File Project Support
Extend the current coding environment into a complete file-tree based
workspace for building multi-file applications and modular projects.

### 3. Mentorship Session Playback
Record synchronized WebRTC communication and coding activity so students
can replay mentorship sessions and review how complex bugs were solved.

### 4. Voice-to-Code Accessibility
Add speech-to-text capabilities that allow users to dictate code,
logic, and editor commands hands-free.

### 5. Direct GitHub Integration
Allow users to authenticate with GitHub, import repositories into a
collaborative coding room, and push completed work directly from the
platform.

### 6. Gamified Coding Challenges
Connect the progress analytics system with a coding challenge engine
that can provide progressively challenging problems based on a
student's learning progress.

---

## Technology Stack

- **Frontend:** React, TypeScript, Monaco Editor
- **Backend:** Node.js, Express, TypeScript
- **Real-Time Communication:** Socket.IO
- **Video/Audio:** WebRTC
- **Database:** MongoDB
- **Code Execution:** Piston API
- **AI:** AI-powered error explanation
- **Containerization:** Docker

---

## Project Goal

Code-Sync aims to combine collaborative programming, communication,
AI-assisted learning, secure code execution, and learning analytics
into a single platform for students and educators.
