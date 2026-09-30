interface VideoCallParticipant {
    socketId: string
    username: string
    stream: MediaStream | null
    isMuted: boolean
    isVideoOff: boolean
}

interface VideoCallContext {
    isInCall: boolean
    isMuted: boolean
    isVideoOff: boolean
    participants: VideoCallParticipant[]
    localStream: MediaStream | null
    joinCall: () => Promise<void>
    leaveCall: () => void
    toggleMute: () => void
    toggleVideo: () => void
}

export type { VideoCallParticipant, VideoCallContext }
