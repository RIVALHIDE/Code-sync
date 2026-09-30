import express, { Response, Request } from "express"
import dotenv from "dotenv"
import http from "http"
import cors from "cors"
import { SocketEvent, SocketId } from "./types/socket"
import { USER_CONNECTION_STATUS, User } from "./types/user"
import { Server } from "socket.io"
import path from "path"

dotenv.config()

const app = express()

app.use(express.json())

app.use(cors())

app.use(express.static(path.join(__dirname, "public"))) // Serve static files

const server = http.createServer(app)
const io = new Server(server, {
	cors: {
		origin: "*",
	},
	maxHttpBufferSize: 1e8,
	pingTimeout: 60000,
})

let userSocketMap: User[] = []

// Track users currently in video calls: Map<roomId, Set<socketId>>
let activeCallParticipants: Map<string, Set<string>> = new Map()

// Function to get all users in a room
function getUsersInRoom(roomId: string): User[] {
	return userSocketMap.filter((user) => user.roomId == roomId)
}

// Function to get room id by socket id
function getRoomId(socketId: SocketId): string | null {
	const roomId = userSocketMap.find(
		(user) => user.socketId === socketId
	)?.roomId

	if (!roomId) {
		console.error("Room ID is undefined for socket ID:", socketId)
		return null
	}
	return roomId
}

function getUserBySocketId(socketId: SocketId): User | null {
	const user = userSocketMap.find((user) => user.socketId === socketId)
	if (!user) {
		console.error("User not found for socket ID:", socketId)
		return null
	}
	return user
}

io.on("connection", (socket) => {
	// Handle user actions
	socket.on(SocketEvent.JOIN_REQUEST, ({ roomId, username }) => {
		// Check is username exist in the room
		const isUsernameExist = getUsersInRoom(roomId).filter(
			(u) => u.username === username
		)
		if (isUsernameExist.length > 0) {
			io.to(socket.id).emit(SocketEvent.USERNAME_EXISTS)
			return
		}

		const user = {
			username,
			roomId,
			status: USER_CONNECTION_STATUS.ONLINE,
			cursorPosition: 0,
			typing: false,
			socketId: socket.id,
			currentFile: null,
		}
		userSocketMap.push(user)
		socket.join(roomId)
		socket.broadcast.to(roomId).emit(SocketEvent.USER_JOINED, { user })
		const users = getUsersInRoom(roomId)
		io.to(socket.id).emit(SocketEvent.JOIN_ACCEPTED, { user, users })
	})

	socket.on("disconnecting", () => {
		const user = getUserBySocketId(socket.id)
		if (!user) return
		const roomId = user.roomId

		// Clean up video call participation
		const callParticipants = activeCallParticipants.get(roomId)
		if (callParticipants) {
			callParticipants.delete(socket.id)
			if (callParticipants.size === 0) {
				activeCallParticipants.delete(roomId)
			} else {
				// Notify others this user left the call
				socket.broadcast.to(roomId).emit(SocketEvent.VIDEO_CALL_USER_LEFT, {
					socketId: socket.id,
				})
			}
		}

		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.USER_DISCONNECTED, { user })
		userSocketMap = userSocketMap.filter((u) => u.socketId !== socket.id)
		socket.leave(roomId)
	})

	// Handle file actions
	socket.on(
		SocketEvent.SYNC_FILE_STRUCTURE,
		({ fileStructure, openFiles, activeFile, socketId }) => {
			io.to(socketId).emit(SocketEvent.SYNC_FILE_STRUCTURE, {
				fileStructure,
				openFiles,
				activeFile,
			})
		}
	)

	socket.on(
		SocketEvent.DIRECTORY_CREATED,
		({ parentDirId, newDirectory }) => {
			const roomId = getRoomId(socket.id)
			if (!roomId) return
			socket.broadcast.to(roomId).emit(SocketEvent.DIRECTORY_CREATED, {
				parentDirId,
				newDirectory,
			})
		}
	)

	socket.on(SocketEvent.DIRECTORY_UPDATED, ({ dirId, children }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.DIRECTORY_UPDATED, {
			dirId,
			children,
		})
	})

	socket.on(SocketEvent.DIRECTORY_RENAMED, ({ dirId, newName }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.DIRECTORY_RENAMED, {
			dirId,
			newName,
		})
	})

	socket.on(SocketEvent.DIRECTORY_DELETED, ({ dirId }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.DIRECTORY_DELETED, { dirId })
	})

	socket.on(SocketEvent.FILE_CREATED, ({ parentDirId, newFile }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.FILE_CREATED, { parentDirId, newFile })
	})

	socket.on(SocketEvent.FILE_UPDATED, ({ fileId, newContent }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.FILE_UPDATED, {
			fileId,
			newContent,
		})
	})

	socket.on(SocketEvent.FILE_RENAMED, ({ fileId, newName }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.FILE_RENAMED, {
			fileId,
			newName,
		})
	})

	socket.on(SocketEvent.FILE_DELETED, ({ fileId }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.FILE_DELETED, { fileId })
	})

	// Handle user status
	socket.on(SocketEvent.USER_OFFLINE, ({ socketId }) => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socketId) {
				return { ...user, status: USER_CONNECTION_STATUS.OFFLINE }
			}
			return user
		})
		const roomId = getRoomId(socketId)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.USER_OFFLINE, { socketId })
	})

	socket.on(SocketEvent.USER_ONLINE, ({ socketId }) => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socketId) {
				return { ...user, status: USER_CONNECTION_STATUS.ONLINE }
			}
			return user
		})
		const roomId = getRoomId(socketId)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.USER_ONLINE, { socketId })
	})

	// Handle chat actions
	socket.on(SocketEvent.SEND_MESSAGE, ({ message }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.RECEIVE_MESSAGE, { message })
	})

	// Handle cursor position and selection
	socket.on(SocketEvent.TYPING_START, ({ cursorPosition, selectionStart, selectionEnd }) => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socket.id) {
				return {
					...user,
					typing: true,
					cursorPosition,
					selectionStart,
					selectionEnd
				}
			}
			return user
		})
		const user = getUserBySocketId(socket.id)
		if (!user) return
		const roomId = user.roomId
		socket.broadcast.to(roomId).emit(SocketEvent.TYPING_START, { user })
	})

	socket.on(SocketEvent.TYPING_PAUSE, () => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socket.id) {
				return { ...user, typing: false }
			}
			return user
		})
		const user = getUserBySocketId(socket.id)
		if (!user) return
		const roomId = user.roomId
		socket.broadcast.to(roomId).emit(SocketEvent.TYPING_PAUSE, { user })
	})

	// Handle cursor movement without typing
	socket.on(SocketEvent.CURSOR_MOVE, ({ cursorPosition, selectionStart, selectionEnd }) => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socket.id) {
				return {
					...user,
					cursorPosition,
					selectionStart,
					selectionEnd
				}
			}
			return user
		})
		const user = getUserBySocketId(socket.id)
		if (!user) return
		const roomId = user.roomId
		socket.broadcast.to(roomId).emit(SocketEvent.CURSOR_MOVE, { user })
	})

	socket.on(SocketEvent.REQUEST_DRAWING, () => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.REQUEST_DRAWING, { socketId: socket.id })
	})

	socket.on(SocketEvent.SYNC_DRAWING, ({ drawingData, socketId }) => {
		socket.broadcast
			.to(socketId)
			.emit(SocketEvent.SYNC_DRAWING, { drawingData })
	})

	socket.on(SocketEvent.DRAWING_UPDATE, ({ snapshot }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.DRAWING_UPDATE, {
			snapshot,
		})
	})

	// Handle WebRTC video call signaling
	socket.on(SocketEvent.VIDEO_CALL_USER_JOINED, ({ username }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return

		// Add to active call participants
		if (!activeCallParticipants.has(roomId)) {
			activeCallParticipants.set(roomId, new Set())
		}
		activeCallParticipants.get(roomId)!.add(socket.id)

		// Get list of existing participants in the call
		const existingParticipants = Array.from(
			activeCallParticipants.get(roomId) || []
		)
			.filter((id) => id !== socket.id)
			.map((id) => {
				const user = getUserBySocketId(id)
				return user ? { socketId: id, username: user.username } : null
			})
			.filter((p) => p !== null)

		// Send existing participants to the new joiner
		if (existingParticipants.length > 0) {
			io.to(socket.id).emit(
				SocketEvent.VIDEO_CALL_PARTICIPANTS_LIST,
				{ participants: existingParticipants }
			)
		}

		// Notify others that this user joined
		socket.broadcast.to(roomId).emit(SocketEvent.VIDEO_CALL_USER_JOINED, {
			socketId: socket.id,
			username,
		})
	})

	socket.on(SocketEvent.VIDEO_CALL_OFFER, ({ targetSocketId, offer }) => {
		const user = getUserBySocketId(socket.id)
		if (!user) return
		io.to(targetSocketId).emit(SocketEvent.VIDEO_CALL_OFFER, {
			senderSocketId: socket.id,
			senderUsername: user.username,
			offer,
		})
	})

	socket.on(SocketEvent.VIDEO_CALL_ANSWER, ({ targetSocketId, answer }) => {
		io.to(targetSocketId).emit(SocketEvent.VIDEO_CALL_ANSWER, {
			senderSocketId: socket.id,
			answer,
		})
	})

	socket.on(
		SocketEvent.VIDEO_CALL_ICE_CANDIDATE,
		({ targetSocketId, candidate }) => {
			io.to(targetSocketId).emit(SocketEvent.VIDEO_CALL_ICE_CANDIDATE, {
				senderSocketId: socket.id,
				candidate,
			})
		}
	)

	socket.on(SocketEvent.VIDEO_CALL_USER_LEFT, () => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return

		// Remove from active call participants
		const callParticipants = activeCallParticipants.get(roomId)
		if (callParticipants) {
			callParticipants.delete(socket.id)
			if (callParticipants.size === 0) {
				activeCallParticipants.delete(roomId)
			}
		}

		socket.broadcast.to(roomId).emit(SocketEvent.VIDEO_CALL_USER_LEFT, {
			socketId: socket.id,
		})
	})

	socket.on(SocketEvent.VIDEO_CALL_MUTE_TOGGLE, ({ isMuted }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.VIDEO_CALL_MUTE_TOGGLE, {
			socketId: socket.id,
			isMuted,
		})
	})

	socket.on(SocketEvent.VIDEO_CALL_VIDEO_TOGGLE, ({ isVideoOff }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.VIDEO_CALL_VIDEO_TOGGLE, {
			socketId: socket.id,
			isVideoOff,
		})
	})
})

const PORT = process.env.PORT || 3000

app.get("/", (req: Request, res: Response) => {
	// Send the index.html file
	res.sendFile(path.join(__dirname, "..", "public", "index.html"))
})

// AI proxy — forwards chat requests to Pollinations /openai endpoint
// Avoids browser-side Turnstile restrictions
app.post("/api/ai/chat", async (req: Request, res: Response) => {
	try {
		const { messages, model = "openai-fast" } = req.body
		if (!messages || !Array.isArray(messages)) {
			res.status(400).json({ error: "messages array is required" })
			return
		}

		const response = await fetch("https://text.pollinations.ai/openai", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ model, messages }),
		})

		if (!response.ok) {
			const errText = await response.text()
			console.error("Pollinations error:", errText)
			res.status(response.status).json({ error: errText })
			return
		}

		const data = await response.json() as any
		const content = data?.choices?.[0]?.message?.content ?? ""
		res.json({ content })
	} catch (err) {
		console.error("AI proxy error:", err)
		res.status(500).json({ error: "Failed to contact AI service" })
	}
})

server.listen(PORT, () => {
	console.log(`Listening on port ${PORT}`)
})
