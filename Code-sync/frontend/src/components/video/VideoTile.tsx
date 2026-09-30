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
            console.log(`[VideoTile] Attaching stream for ${participant.username}`, participant.stream)
            videoElement.srcObject = participant.stream
            
            // Force play after stream is attached
            videoElement.play().catch((err) => {
                console.error(`[VideoTile] Failed to play video for ${participant.username}:`, err)
            })
        }
        
        return () => {
            if (videoElement) {
                videoElement.srcObject = null
            }
        }
    }, [participant.stream, participant.username])

    return (
        <div className="relative flex flex-col overflow-hidden rounded-lg bg-darkHover">
            {participant.isVideoOff || !participant.stream ? (
                <div className="flex h-full min-h-[120px] w-full items-center justify-center bg-darkHover">
                    <div className="flex flex-col items-center gap-2">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-dark">
                            {participant.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs text-white/70">
                            {participant.isVideoOff ? "Camera off" : "Connecting..."}
                        </span>
                    </div>
                </div>
            ) : (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={isLocal} // always mute local to avoid feedback
                    className="h-full w-full object-cover"
                />
            )}

            {/* Name + status badges */}
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-2 py-1">
                <span className="truncate text-xs font-medium text-white">
                    {participant.username}
                    {isLocal && " (You)"}
                </span>
                <div className="flex items-center gap-1">
                    {participant.isMuted && (
                        <BsMicMuteFill size={12} className="text-red-400" />
                    )}
                    {participant.isVideoOff && (
                        <FaVideoSlash size={12} className="text-red-400" />
                    )}
                </div>
            </div>
        </div>
    )
}

export default VideoTile
