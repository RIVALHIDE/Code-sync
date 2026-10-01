import { VideoCallParticipant } from "@/types/videoCall"
import { useEffect, useRef } from "react"
import { BsMicMuteFill } from "react-icons/bs"
import { FaVideoSlash } from "react-icons/fa"

interface VideoTileProps {
    participant: VideoCallParticipant
    isLocal?: boolean
}

function VideoTile({ participant, isLocal = false }: VideoTileProps) {
    const videoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
        const videoElement = videoRef.current
        if (videoElement && participant.stream) {
            videoElement.srcObject = participant.stream
            videoElement.play().catch((err) => {
                console.error(
                    `[VideoTile] Failed to play video for ${participant.username}:`,
                    err,
                )
            })
        }
        return () => {
            if (videoElement) {
                videoElement.srcObject = null
            }
        }
    }, [participant.stream, participant.username])

    return (
        <article
            className="video-tile"
            aria-label={`${participant.username}${isLocal ? " (You)" : ""}`}
        >
            <div className="video-tile-frame">
                {/* Keep this element mounted so camera toggles retain srcObject and
                    remote audio continues playing while the camera is off. */}
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={isLocal}
                    aria-label={`${participant.username}'s camera`}
                    className={`video-tile-feed ${isLocal ? "is-local" : ""} ${participant.isVideoOff || !participant.stream ? "is-hidden" : ""}`}
                />
                {(participant.isVideoOff || !participant.stream) && (
                    <div className="video-tile-placeholder">
                        <span className="video-participant-avatar">
                            {participant.username.slice(0, 2).toUpperCase() ||
                                "?"}
                        </span>
                        <span>
                            {participant.isVideoOff
                                ? "Camera off"
                                : "Connecting…"}
                        </span>
                    </div>
                )}
            </div>
            <div className="video-tile-meta">
                <span
                    className="video-participant-name"
                    title={participant.username}
                >
                    {participant.username}
                </span>
                {isLocal && <span className="video-self-badge">You</span>}
                <span className="video-participant-status">
                    {participant.isMuted && (
                        <BsMicMuteFill
                            size={12}
                            title="Microphone muted"
                            aria-label="Microphone muted"
                        />
                    )}
                    {participant.isVideoOff && (
                        <FaVideoSlash
                            size={12}
                            title="Camera off"
                            aria-label="Camera off"
                        />
                    )}
                </span>
            </div>
        </article>
    )
}

export default VideoTile
