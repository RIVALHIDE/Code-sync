import { SocketEvent } from "@/types/socket"
import { VideoCallContext as VideoCallContextType, VideoCallParticipant } from "@/types/videoCall"
import {
    ReactNode,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react"
import toast from "react-hot-toast"
import { useAppContext } from "./AppContext"
import { useSocket } from "./SocketContext"

const VideoCallContext = createContext<VideoCallContextType | null>(null)

export const useVideoCall = (): VideoCallContextType => {
    const context = useContext(VideoCallContext)
    if (!context) {
        throw new Error("useVideoCall must be used within a VideoCallContextProvider")
    }
    return context
}

// STUN servers for ICE candidate gathering (Google's public STUN servers)
const ICE_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
    ],
}

function VideoCallContextProvider({ children }: { children: ReactNode }) {
    const { socket } = useSocket()
    const { currentUser } = useAppContext()

    const [isInCall, setIsInCall] = useState(false)
    const [isMuted, setIsMuted] = useState(false)
    const [isVideoOff, setIsVideoOff] = useState(false)
    const [participants, setParticipants] = useState<VideoCallParticipant[]>([])
    const [localStream, setLocalStream] = useState<MediaStream | null>(null)

    // Map of socketId -> RTCPeerConnection
    const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map())
    // Keep localStream in a ref so callbacks always see latest value
    const localStreamRef = useRef<MediaStream | null>(null)

    const createPeerConnection = useCallback(
        (remoteSocketId: string, remoteUsername: string): RTCPeerConnection => {
            const pc = new RTCPeerConnection(ICE_SERVERS)

            // Add local tracks to the connection
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => {
                    pc.addTrack(track, localStreamRef.current!)
                })
            }

            // When we receive a remote track, add participant stream
            pc.ontrack = (event) => {
                const [remoteStream] = event.streams
                console.log(`[WebRTC] Received track from ${remoteUsername}:`, remoteStream, remoteStream.getTracks())
                setParticipants((prev) => {
                    const existing = prev.find((p) => p.socketId === remoteSocketId)
                    if (existing) {
                        console.log(`[WebRTC] Updating existing participant ${remoteUsername} with stream`)
                        return prev.map((p) =>
                            p.socketId === remoteSocketId
                                ? { ...p, stream: remoteStream }
                                : p,
                        )
                    }
                    console.log(`[WebRTC] Adding new participant ${remoteUsername} with stream`)
                    return [
                        ...prev,
                        {
                            socketId: remoteSocketId,
                            username: remoteUsername,
                            stream: remoteStream,
                            isMuted: false,
                            isVideoOff: false,
                        },
                    ]
                })
            }

            // Send ICE candidates through signaling server
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit(SocketEvent.VIDEO_CALL_ICE_CANDIDATE, {
                        targetSocketId: remoteSocketId,
                        candidate: event.candidate,
                    })
                }
            }

            pc.onconnectionstatechange = () => {
                if (
                    pc.connectionState === "disconnected" ||
                    pc.connectionState === "failed" ||
                    pc.connectionState === "closed"
                ) {
                    setParticipants((prev) =>
                        prev.filter((p) => p.socketId !== remoteSocketId),
                    )
                    peerConnections.current.delete(remoteSocketId)
                }
            }

            peerConnections.current.set(remoteSocketId, pc)
            return pc
        },
        [socket],
    )

    const joinCall = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            })
            localStreamRef.current = stream
            setLocalStream(stream)
            setIsInCall(true)

            // Notify other room members that we joined the call
            console.log("[VideoCall] Joining call, emitting VIDEO_CALL_USER_JOINED")
            socket.emit(SocketEvent.VIDEO_CALL_USER_JOINED, {
                username: currentUser.username,
            })
            toast.success("Joined the video call")
        } catch (err) {
            console.error("Failed to access media devices:", err)
            toast.error("Could not access camera/microphone. Check permissions.")
        }
    }, [socket, currentUser.username])

    const leaveCall = useCallback(() => {
        // Stop all local tracks
        localStreamRef.current?.getTracks().forEach((track) => track.stop())
        localStreamRef.current = null
        setLocalStream(null)

        // Close all peer connections
        peerConnections.current.forEach((pc) => pc.close())
        peerConnections.current.clear()

        setParticipants([])
        setIsInCall(false)
        setIsMuted(false)
        setIsVideoOff(false)

        socket.emit(SocketEvent.VIDEO_CALL_USER_LEFT)
        toast.success("Left the video call")
    }, [socket])

    const toggleMute = useCallback(() => {
        if (!localStreamRef.current) return
        const audioTrack = localStreamRef.current.getAudioTracks()[0]
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled
            setIsMuted(!audioTrack.enabled)
            socket.emit(SocketEvent.VIDEO_CALL_MUTE_TOGGLE, {
                isMuted: !audioTrack.enabled,
            })
        }
    }, [socket])

    const toggleVideo = useCallback(() => {
        if (!localStreamRef.current) return
        const videoTrack = localStreamRef.current.getVideoTracks()[0]
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled
            setIsVideoOff(!videoTrack.enabled)
            socket.emit(SocketEvent.VIDEO_CALL_VIDEO_TOGGLE, {
                isVideoOff: !videoTrack.enabled,
            })
        }
    }, [socket])

    // --- Socket event handlers ---

    // Received list of existing participants when we join
    const handleParticipantsList = useCallback(
        async ({
            participants,
        }: {
            participants: Array<{ socketId: string; username: string }>
        }) => {
            console.log("[VideoCall] Received participants list:", participants)
            if (!localStreamRef.current) return

            // Create peer connections and send offers to all existing participants
            for (const participant of participants) {
                console.log("[VideoCall] Creating peer connection to:", participant.username)
                setParticipants((prev) => {
                    if (prev.find((p) => p.socketId === participant.socketId))
                        return prev
                    return [
                        ...prev,
                        {
                            socketId: participant.socketId,
                            username: participant.username,
                            stream: null,
                            isMuted: false,
                            isVideoOff: false,
                        },
                    ]
                })

                const pc = createPeerConnection(
                    participant.socketId,
                    participant.username,
                )
                try {
                    const offer = await pc.createOffer()
                    await pc.setLocalDescription(offer)
                    console.log("[VideoCall] Sending offer to:", participant.username)
                    socket.emit(SocketEvent.VIDEO_CALL_OFFER, {
                        targetSocketId: participant.socketId,
                        offer,
                    })
                } catch (err) {
                    console.error("Error creating offer:", err)
                }
            }
        },
        [createPeerConnection, socket],
    )

    // Someone else joined the call — initiate offer to them
    const handleUserJoined = useCallback(
        async ({ socketId, username }: { socketId: string; username: string }) => {
            console.log("[VideoCall] User joined:", username, socketId)
            if (!localStreamRef.current) return

            // Add placeholder participant immediately
            setParticipants((prev) => {
                if (prev.find((p) => p.socketId === socketId)) return prev
                return [
                    ...prev,
                    { socketId, username, stream: null, isMuted: false, isVideoOff: false },
                ]
            })

            // Only the user with the smaller socket ID initiates the offer
            // This prevents both sides from creating offers simultaneously
            if (socket.id! < socketId) {
                const pc = createPeerConnection(socketId, username)
                try {
                    console.log("[VideoCall] Creating offer for new user (I am initiator):", username)
                    const offer = await pc.createOffer()
                    await pc.setLocalDescription(offer)
                    socket.emit(SocketEvent.VIDEO_CALL_OFFER, {
                        targetSocketId: socketId,
                        offer,
                    })
                } catch (err) {
                    console.error("Error creating offer:", err)
                }
            } else {
                console.log("[VideoCall] New user joined but they will initiate (they are initiator):", username)
            }
        },
        [createPeerConnection, socket],
    )

    // We received an offer — send back an answer
    const handleOffer = useCallback(
        async ({
            senderSocketId,
            senderUsername,
            offer,
        }: {
            senderSocketId: string
            senderUsername: string
            offer: RTCSessionDescriptionInit
        }) => {
            console.log("[VideoCall] Received offer from:", senderUsername)
            if (!localStreamRef.current) return

            setParticipants((prev) => {
                if (prev.find((p) => p.socketId === senderSocketId)) return prev
                return [
                    ...prev,
                    {
                        socketId: senderSocketId,
                        username: senderUsername,
                        stream: null,
                        isMuted: false,
                        isVideoOff: false,
                    },
                ]
            })

            const pc = createPeerConnection(senderSocketId, senderUsername)
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(offer))
                const answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)
                console.log("[VideoCall] Sending answer to:", senderUsername)
                socket.emit(SocketEvent.VIDEO_CALL_ANSWER, {
                    targetSocketId: senderSocketId,
                    answer,
                })
            } catch (err) {
                console.error("Error handling offer:", err)
            }
        },
        [createPeerConnection, socket],
    )

    // We received an answer to our offer
    const handleAnswer = useCallback(
        async ({
            senderSocketId,
            answer,
        }: {
            senderSocketId: string
            answer: RTCSessionDescriptionInit
        }) => {
            console.log("[VideoCall] Received answer from:", senderSocketId)
            const pc = peerConnections.current.get(senderSocketId)
            if (!pc) {
                console.error("[VideoCall] No peer connection found for:", senderSocketId)
                return
            }
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(answer))
                console.log("[VideoCall] Set remote description successfully")
            } catch (err) {
                console.error("Error handling answer:", err)
            }
        },
        [],
    )

    // Received an ICE candidate from a peer
    const handleIceCandidate = useCallback(
        async ({
            senderSocketId,
            candidate,
        }: {
            senderSocketId: string
            candidate: RTCIceCandidateInit
        }) => {
            const pc = peerConnections.current.get(senderSocketId)
            if (!pc) return
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate))
            } catch (err) {
                console.error("Error adding ICE candidate:", err)
            }
        },
        [],
    )

    // A participant left the call
    const handleUserLeft = useCallback(({ socketId }: { socketId: string }) => {
        const pc = peerConnections.current.get(socketId)
        if (pc) {
            pc.close()
            peerConnections.current.delete(socketId)
        }
        setParticipants((prev) => prev.filter((p) => p.socketId !== socketId))
    }, [])

    // A peer toggled their mic
    const handleMuteToggle = useCallback(
        ({ socketId, isMuted }: { socketId: string; isMuted: boolean }) => {
            setParticipants((prev) =>
                prev.map((p) =>
                    p.socketId === socketId ? { ...p, isMuted } : p,
                ),
            )
        },
        [],
    )

    // A peer toggled their camera
    const handleVideoToggle = useCallback(
        ({ socketId, isVideoOff }: { socketId: string; isVideoOff: boolean }) => {
            setParticipants((prev) =>
                prev.map((p) =>
                    p.socketId === socketId ? { ...p, isVideoOff } : p,
                ),
            )
        },
        [],
    )

    useEffect(() => {
        socket.on(SocketEvent.VIDEO_CALL_PARTICIPANTS_LIST, handleParticipantsList)
        socket.on(SocketEvent.VIDEO_CALL_USER_JOINED, handleUserJoined)
        socket.on(SocketEvent.VIDEO_CALL_OFFER, handleOffer)
        socket.on(SocketEvent.VIDEO_CALL_ANSWER, handleAnswer)
        socket.on(SocketEvent.VIDEO_CALL_ICE_CANDIDATE, handleIceCandidate)
        socket.on(SocketEvent.VIDEO_CALL_USER_LEFT, handleUserLeft)
        socket.on(SocketEvent.VIDEO_CALL_MUTE_TOGGLE, handleMuteToggle)
        socket.on(SocketEvent.VIDEO_CALL_VIDEO_TOGGLE, handleVideoToggle)

        return () => {
            socket.off(SocketEvent.VIDEO_CALL_PARTICIPANTS_LIST)
            socket.off(SocketEvent.VIDEO_CALL_USER_JOINED)
            socket.off(SocketEvent.VIDEO_CALL_OFFER)
            socket.off(SocketEvent.VIDEO_CALL_ANSWER)
            socket.off(SocketEvent.VIDEO_CALL_ICE_CANDIDATE)
            socket.off(SocketEvent.VIDEO_CALL_USER_LEFT)
            socket.off(SocketEvent.VIDEO_CALL_MUTE_TOGGLE)
            socket.off(SocketEvent.VIDEO_CALL_VIDEO_TOGGLE)
        }
    }, [
        handleParticipantsList,
        handleUserJoined,
        handleOffer,
        handleAnswer,
        handleIceCandidate,
        handleUserLeft,
        handleMuteToggle,
        handleVideoToggle,
        socket,
    ])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            localStreamRef.current?.getTracks().forEach((t) => t.stop())
            peerConnections.current.forEach((pc) => pc.close())
        }
    }, [])

    return (
        <VideoCallContext.Provider
            value={{
                isInCall,
                isMuted,
                isVideoOff,
                participants,
                localStream,
                joinCall,
                leaveCall,
                toggleMute,
                toggleVideo,
            }}
        >
            {children}
        </VideoCallContext.Provider>
    )
}

export { VideoCallContextProvider }
export default VideoCallContext
