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
    isRecordingCall: boolean
    joinCall: () => Promise<void>
    leaveCall: () => void
    toggleMute: () => void
    toggleVideo: () => void
    startCallRecording: () => void
    stopCallRecording: () => void
}

export type { VideoCallParticipant, VideoCallContext }
