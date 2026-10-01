import { useAppContext } from "@/context/AppContext"
import { useVideoCall } from "@/context/VideoCallContext"
import { VideoCallParticipant } from "@/types/videoCall"
import { useState } from "react"
import { BsMicFill, BsMicMuteFill } from "react-icons/bs"
import { FaPhone, FaPhoneSlash, FaVideo, FaVideoSlash } from "react-icons/fa"
import { LuCircle, LuLoader2, LuSquare, LuUsers } from "react-icons/lu"
import VideoTile from "./VideoTile"
import "@/styles/video-call.css"

function VideoCall() {
    const { currentUser } = useAppContext()
    const {
        isInCall,
        isMuted,
        isVideoOff,
        isRecordingCall,
        participants,
        localStream,
        joinCall,
        leaveCall,
        toggleMute,
        toggleVideo,
        startCallRecording,
        stopCallRecording,
    } = useVideoCall()
    const [isJoining, setIsJoining] = useState(false)

    const localParticipant: VideoCallParticipant = {
        socketId: "local",
        username: currentUser.username,
        stream: localStream,
        isMuted,
        isVideoOff,
    }
    const allParticipants = isInCall ? [localParticipant, ...participants] : []

    const handleJoin = async () => {
        setIsJoining(true)
        try {
            await joinCall()
        } finally {
            setIsJoining(false)
        }
    }

    if (!isInCall) {
        return (
            <div className="video-call-lobby">
                <div className="video-lobby-icon">
                    <FaVideo size={24} />
                </div>
                <h2>Better face to face.</h2>
                <p>
                    Talk through ideas, share a moment, and keep building
                    together.
                </p>
                <button
                    onClick={handleJoin}
                    disabled={isJoining}
                    className="video-join-button"
                >
                    {isJoining ? (
                        <LuLoader2 size={16} className="animate-spin" />
                    ) : (
                        <FaPhone size={13} />
                    )}
                    {isJoining ? "Connecting…" : "Join Call"}
                </button>
                <span className="video-lobby-note">
                    Your browser will ask for camera and microphone access.
                </span>
            </div>
        )
    }

    return (
        <div className="video-call">
            <div className="video-call-summary">
                <span>
                    <LuUsers size={14} />
                    In this call <strong>{allParticipants.length}</strong>
                </span>
                <span className="video-live-badge">
                    <span />
                    Live
                </span>
            </div>
            {isRecordingCall && (
                <div className="video-recording-notice" role="status">
                    <LuCircle size={9} className="fill-current" />
                    Recording call…
                </div>
            )}

            <div className="video-call-scroll" aria-label="Call participants">
                <div className="video-participant-grid">
                    {allParticipants.map((participant) => (
                        <VideoTile
                            key={participant.socketId}
                            participant={participant}
                            isLocal={participant.socketId === "local"}
                        />
                    ))}
                </div>
                {allParticipants.length === 1 && (
                    <div className="video-waiting-state">
                        <LuUsers size={18} />
                        <strong>A little quiet in here</strong>
                        <p>
                            Use Invite in the workspace header to bring your
                            team. They can join this call from the Video tab.
                        </p>
                    </div>
                )}
            </div>

            <div
                className="video-call-controls"
                role="group"
                aria-label="Call controls"
            >
                <button
                    onClick={toggleMute}
                    title={isMuted ? "Unmute" : "Mute"}
                    aria-label={
                        isMuted ? "Unmute microphone" : "Mute microphone"
                    }
                    aria-pressed={isMuted}
                    className={`video-control ${isMuted ? "is-off" : ""}`}
                >
                    <span className="video-control-icon">
                        {isMuted ? (
                            <BsMicMuteFill size={16} />
                        ) : (
                            <BsMicFill size={16} />
                        )}
                    </span>
                    <span>{isMuted ? "Unmute" : "Mic on"}</span>
                </button>
                <button
                    onClick={toggleVideo}
                    title={isVideoOff ? "Turn on camera" : "Turn off camera"}
                    aria-label={
                        isVideoOff ? "Turn on camera" : "Turn off camera"
                    }
                    aria-pressed={!isVideoOff}
                    className={`video-control ${isVideoOff ? "is-off" : ""}`}
                >
                    <span className="video-control-icon">
                        {isVideoOff ? (
                            <FaVideoSlash size={16} />
                        ) : (
                            <FaVideo size={16} />
                        )}
                    </span>
                    <span>{isVideoOff ? "Cam off" : "Cam on"}</span>
                </button>
                <button
                    onClick={
                        isRecordingCall ? stopCallRecording : startCallRecording
                    }
                    title={isRecordingCall ? "Stop recording" : "Record call"}
                    aria-label={
                        isRecordingCall ? "Stop recording" : "Record call"
                    }
                    aria-pressed={isRecordingCall}
                    className={`video-control ${isRecordingCall ? "is-recording" : ""}`}
                >
                    <span className="video-control-icon">
                        {isRecordingCall ? (
                            <LuSquare size={16} />
                        ) : (
                            <LuCircle size={16} />
                        )}
                    </span>
                    <span>{isRecordingCall ? "Stop" : "Record"}</span>
                </button>
                <button
                    onClick={leaveCall}
                    title="Leave call"
                    aria-label="Leave call"
                    className="video-control is-leave"
                >
                    <span className="video-control-icon">
                        <FaPhoneSlash size={16} />
                    </span>
                    <span>Leave</span>
                </button>
            </div>
        </div>
    )
}

export default VideoCall
