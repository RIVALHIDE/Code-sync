import { useAppContext } from "@/context/AppContext"
import { useVideoCall } from "@/context/VideoCallContext"
import { VideoCallParticipant } from "@/types/videoCall"
import { BsMicFill, BsMicMuteFill } from "react-icons/bs"
import { FaPhone, FaPhoneSlash, FaVideo, FaVideoSlash } from "react-icons/fa"
import { LuCircle, LuSquare } from "react-icons/lu"
import VideoTile from "./VideoTile"

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

    const localParticipant: VideoCallParticipant = {
        socketId: "local",
        username: currentUser.username,
        stream: localStream,
        isMuted,
        isVideoOff,
    }

    const allParticipants = isInCall ? [localParticipant, ...participants] : []

    const gridCols =
        allParticipants.length <= 1
            ? "grid-cols-1"
            : allParticipants.length <= 4
              ? "grid-cols-2"
              : "grid-cols-3"

    if (!isInCall) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
                    <FaVideo size={28} className="text-primary" />
                </div>
                <div>
                    <h2 className="text-base font-semibold text-white">
                        Video & Audio Call
                    </h2>
                    <p className="mt-1 text-sm text-white/50">
                        Start a peer-to-peer call with everyone in the room.
                    </p>
                </div>
                <button
                    onClick={joinCall}
                    className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-dark transition-opacity hover:opacity-90"
                >
                    <FaPhone size={14} />
                    Join Call
                </button>
            </div>
        )
    }

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            {/* Recording indicator */}
            {isRecordingCall && (
                <div className="flex items-center gap-2 bg-red-600/20 px-3 py-1.5">
                    <LuCircle size={10} className="animate-pulse fill-red-500 text-red-500" />
                    <span className="text-xs font-medium text-red-400">Recording call...</span>
                </div>
            )}

            {/* Video grid */}
            <div className={`grid flex-1 gap-2 overflow-y-auto p-3 ${gridCols}`}>
                {allParticipants.map((p) => (
                    <VideoTile
                        key={p.socketId}
                        participant={p}
                        isLocal={p.socketId === "local"}
                    />
                ))}
                {allParticipants.length === 1 && (
                    <div className="flex items-center justify-center rounded-lg border border-dashed border-white/20 text-xs text-white/40">
                        Waiting for others to join...
                    </div>
                )}
            </div>

            {/* Controls bar */}
            <div className="flex items-center justify-center gap-3 border-t border-darkHover px-4 py-3">
                {/* Mute */}
                <button
                    onClick={toggleMute}
                    title={isMuted ? "Unmute" : "Mute"}
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                        isMuted
                            ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                            : "bg-darkHover text-white hover:bg-white/10"
                    }`}
                >
                    {isMuted ? <BsMicMuteFill size={18} /> : <BsMicFill size={18} />}
                </button>

                {/* Video */}
                <button
                    onClick={toggleVideo}
                    title={isVideoOff ? "Turn on camera" : "Turn off camera"}
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                        isVideoOff
                            ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                            : "bg-darkHover text-white hover:bg-white/10"
                    }`}
                >
                    {isVideoOff ? <FaVideoSlash size={18} /> : <FaVideo size={18} />}
                </button>

                {/* Record call */}
                <button
                    onClick={isRecordingCall ? stopCallRecording : startCallRecording}
                    title={isRecordingCall ? "Stop recording" : "Record call"}
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                        isRecordingCall
                            ? "bg-red-600 text-white hover:bg-red-700"
                            : "bg-darkHover text-white hover:bg-white/10"
                    }`}
                >
                    {isRecordingCall ? <LuSquare size={16} /> : <LuCircle size={16} />}
                </button>

                {/* Leave */}
                <button
                    onClick={leaveCall}
                    title="Leave call"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white transition-colors hover:bg-red-700"
                >
                    <FaPhoneSlash size={18} />
                </button>
            </div>
        </div>
    )
}

export default VideoCall
