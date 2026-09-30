import { Socket } from "socket.io"

type SocketId = string

enum SocketEvent {
	JOIN_REQUEST = "join-request",
	JOIN_ACCEPTED = "join-accepted",
	USER_JOINED = "user-joined",
	USER_DISCONNECTED = "user-disconnected",
	SYNC_FILE_STRUCTURE = "sync-file-structure",
	DIRECTORY_CREATED = "directory-created",
	DIRECTORY_UPDATED = "directory-updated",
	DIRECTORY_RENAMED = "directory-renamed",
	DIRECTORY_DELETED = "directory-deleted",
	FILE_CREATED = "file-created",
	FILE_UPDATED = "file-updated",
	FILE_RENAMED = "file-renamed",
	FILE_DELETED = "file-deleted",
	USER_OFFLINE = "offline",
	USER_ONLINE = "online",
	SEND_MESSAGE = "send-message",
	RECEIVE_MESSAGE = "receive-message",
	TYPING_START = "typing-start",
	TYPING_PAUSE = "typing-pause",
	CURSOR_MOVE = "cursor-move",
	USERNAME_EXISTS = "username-exists",
	REQUEST_DRAWING = "request-drawing",
	SYNC_DRAWING = "sync-drawing",
	DRAWING_UPDATE = "drawing-update",
	// WebRTC video/audio call signaling
	VIDEO_CALL_REQUEST_PARTICIPANTS = "video-call-request-participants",
	VIDEO_CALL_PARTICIPANTS_LIST = "video-call-participants-list",
	VIDEO_CALL_OFFER = "video-call-offer",
	VIDEO_CALL_ANSWER = "video-call-answer",
	VIDEO_CALL_ICE_CANDIDATE = "video-call-ice-candidate",
	VIDEO_CALL_USER_JOINED = "video-call-user-joined",
	VIDEO_CALL_USER_LEFT = "video-call-user-left",
	VIDEO_CALL_MUTE_TOGGLE = "video-call-mute-toggle",
	VIDEO_CALL_VIDEO_TOGGLE = "video-call-video-toggle",
	// Collaborative AI Prompt Engineering
	CO_PROMPT_UPDATE = "co-prompt-update",
	CO_PROMPT_LINK_CODE = "co-prompt-link-code",
	CO_PROMPT_UNLINK_CODE = "co-prompt-unlink-code",
	CO_PROMPT_CURSOR = "co-prompt-cursor",
	CO_PROMPT_SUBMIT = "co-prompt-submit",
	CO_PROMPT_RESPONSE = "co-prompt-response",
	CO_PROMPT_CLEAR = "co-prompt-clear",
}

interface SocketContext {
	socket: Socket
}

export { SocketEvent, SocketContext, SocketId }
