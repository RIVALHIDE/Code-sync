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
    const [isRecordingCall, setIsRecordingCall] = useState(false)

    // Map of socketId -> RTCPeerConnection
    const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map())
    // Trickle ICE can arrive before the offer or while remote SDP is being applied.
    const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
    // Keep localStream in a ref so callbacks always see latest value
    const localStreamRef = useRef<MediaStream | null>(null)
    const isJoiningCall = useRef(false)

    // Video recording refs
    const callMediaRecorder = useRef<MediaRecorder | null>(null)
    const callRecordingChunks = useRef<Blob[]>([])

    const createPeerConnection = useCallback(
        (remoteSocketId: string, remoteUsername: string): RTCPeerConnection => {
            const existing = peerConnections.current.get(remoteSocketId)
            if (existing) return existing

            const pc = new RTCPeerConnection(ICE_SERVERS)

            // Add local tracks to the connection
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => {
                    pc.addTrack(track, localStreamRef.current!)
                })
            }

            // Keep one stream per peer, including streamless WebRTC track events.
            const fallbackStream = new MediaStream()
            pc.ontrack = (event) => {
                if (peerConnections.current.get(remoteSocketId) !== pc) return
                const remoteStream = event.streams[0] ?? fallbackStream
                if (!remoteStream.getTracks().some((track) => track.id === event.track.id)) {
                    remoteStream.addTrack(event.track)
                }
                setParticipants((prev) => {
                    const existing = prev.find((p) => p.socketId === remoteSocketId)
                    if (existing) {
                        return prev.map((p) =>
                            p.socketId === remoteSocketId
                                ? { ...p, stream: remoteStream }
                                : p,
                        )
                    }
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
                if (peerConnections.current.get(remoteSocketId) !== pc) return
                // A temporary disconnection can recover; do not orphan a live peer.
                if (pc.connectionState === "failed" || pc.connectionState === "closed") {
                    peerConnections.current.delete(remoteSocketId)
                    pendingCandidates.current.delete(remoteSocketId)
                    pc.close()
                    setParticipants((prev) =>
                        prev.filter((p) => p.socketId !== remoteSocketId),
                    )
                }
            }

            peerConnections.current.set(remoteSocketId, pc)
            return pc
        },
        [socket],
    )

    const flushPendingCandidates = useCallback(async (socketId: string, pc: RTCPeerConnection) => {
        const candidates = pendingCandidates.current.get(socketId) ?? []
        pendingCandidates.current.delete(socketId)
        for (const candidate of candidates) {
            if (peerConnections.current.get(socketId) !== pc) return
            try {
                await pc.addIceCandidate(candidate)
            } catch (err) {
                console.error("Error adding queued ICE candidate:", err)
            }
        }
    }, [])

    const joinCall = useCallback(async () => {
        if (localStreamRef.current || isJoiningCall.current) return
        isJoiningCall.current = true
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            })
            localStreamRef.current = stream
            setLocalStream(stream)
            setIsInCall(true)
            socket.emit(SocketEvent.VIDEO_CALL_USER_JOINED, {
                username: currentUser.username,
            })
            toast.success("Joined the video call")
        } catch (err) {
            console.error("Failed to access media devices:", err)
            toast.error("Could not access camera/microphone. Check permissions.")
        } finally {
            isJoiningCall.current = false
        }
    }, [socket, currentUser.username])

    const leaveCall = useCallback(() => {
        if (callMediaRecorder.current?.state !== "inactive") {
            callMediaRecorder.current?.stop()
        }
        localStreamRef.current?.getTracks().forEach((track) => track.stop())
        localStreamRef.current = null
        setLocalStream(null)
        const connections = [...peerConnections.current.values()]
        peerConnections.current.clear()
        pendingCandidates.current.clear()
        connections.forEach((pc) => pc.close())
        setParticipants([])
        setIsInCall(false)
        setIsMuted(false)
        setIsVideoOff(false)
        setIsRecordingCall(false)
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

    const startCallRecording = useCallback(() => {
        if (!localStreamRef.current) return
        callRecordingChunks.current = []
        const tracks: MediaStreamTrack[] = []
        localStreamRef.current.getTracks().forEach((t) => tracks.push(t))
        participants.forEach(({ stream }) => {
            stream?.getAudioTracks().forEach((t) => tracks.push(t))
        })
        const combined = new MediaStream(tracks)
        const mr = new MediaRecorder(combined, { mimeType: "video/webm;codecs=vp8,opus" })
        mr.ondataavailable = (e) => {
            if (e.data.size > 0) callRecordingChunks.current.push(e.data)
        }
        mr.onstop = () => {
            const blob = new Blob(callRecordingChunks.current, { type: "video/webm" })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `call-recording-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.webm`
            a.click()
            URL.revokeObjectURL(url)
            toast.success("Call recording saved")
            setIsRecordingCall(false)
        }
        mr.start(500)
        callMediaRecorder.current = mr
        setIsRecordingCall(true)
        toast.success("Recording call...")
    }, [participants])

    const stopCallRecording = useCallback(() => {
        if (callMediaRecorder.current?.state !== "inactive") {
            callMediaRecorder.current?.stop()
        }
    }, [])

    // --- Socket event handlers ---

    const handleParticipantsList = useCallback(
        async ({
            participants,
        }: {
            participants: Array<{ socketId: string; username: string }>
        }) => {
            if (!localStreamRef.current) return
            // The server sends this list only to the new caller. That caller is
            // the sole offerer; existing callers wait for the incoming offer.
            for (const participant of participants) {
                if (!localStreamRef.current) return
                if (participant.socketId === socket.id || peerConnections.current.has(participant.socketId)) continue
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
                    if (peerConnections.current.get(participant.socketId) !== pc) continue
                    socket.emit(SocketEvent.VIDEO_CALL_OFFER, {
                        targetSocketId: participant.socketId,
                        offer: pc.localDescription,
                    })
                } catch (err) {
                    console.error("Error creating offer:", err)
                }
            }
        },
        [createPeerConnection, socket],
    )

    const handleUserJoined = useCallback(
        ({ socketId, username }: { socketId: string; username: string }) => {
            if (!localStreamRef.current || socketId === socket.id) return
            setParticipants((prev) => {
                if (prev.find((p) => p.socketId === socketId)) return prev
                return [
                    ...prev,
                    { socketId, username, stream: null, isMuted: false, isVideoOff: false },
                ]
            })
            // Do not send an offer here: the new caller receives the participant
            // list and initiates. Offering on both events causes SDP collisions.
        },
        [socket],
    )

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
                await pc.setRemoteDescription(offer)
                await flushPendingCandidates(senderSocketId, pc)
                if (peerConnections.current.get(senderSocketId) !== pc) return
                const answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)
                if (peerConnections.current.get(senderSocketId) !== pc) return
                socket.emit(SocketEvent.VIDEO_CALL_ANSWER, {
                    targetSocketId: senderSocketId,
                    answer: pc.localDescription,
                })
            } catch (err) {
                console.error("Error handling offer:", err)
            }
        },
        [createPeerConnection, flushPendingCandidates, socket],
    )

    const handleAnswer = useCallback(
        async ({
            senderSocketId,
            answer,
        }: {
            senderSocketId: string
            answer: RTCSessionDescriptionInit
        }) => {
            const pc = peerConnections.current.get(senderSocketId)
            if (!pc) return
            try {
                await pc.setRemoteDescription(answer)
                await flushPendingCandidates(senderSocketId, pc)
            } catch (err) {
                console.error("Error handling answer:", err)
            }
        },
        [flushPendingCandidates],
    )

    const handleIceCandidate = useCallback(
        async ({
            senderSocketId,
            candidate,
        }: {
            senderSocketId: string
            candidate: RTCIceCandidateInit
        }) => {
            if (!localStreamRef.current) return
            const pc = peerConnections.current.get(senderSocketId)
            if (!pc?.remoteDescription) {
                const candidates = pendingCandidates.current.get(senderSocketId) ?? []
                candidates.push(candidate)
                pendingCandidates.current.set(senderSocketId, candidates)
                return
            }
            try {
                await pc.addIceCandidate(candidate)
            } catch (err) {
                console.error("Error adding ICE candidate:", err)
            }
        },
        [],
    )

    const handleUserLeft = useCallback(({ socketId }: { socketId: string }) => {
        const pc = peerConnections.current.get(socketId)
        peerConnections.current.delete(socketId)
        pendingCandidates.current.delete(socketId)
        pc?.close()
        setParticipants((prev) => prev.filter((p) => p.socketId !== socketId))
    }, [])

    const handleMuteToggle = useCallback(
        ({ socketId, isMuted }: { socketId: string; isMuted: boolean }) => {
            setParticipants((prev) =>
                prev.map((p) => p.socketId === socketId ? { ...p, isMuted } : p),
            )
        },
        [],
    )

    const handleVideoToggle = useCallback(
        ({ socketId, isVideoOff }: { socketId: string; isVideoOff: boolean }) => {
            setParticipants((prev) =>
                prev.map((p) => p.socketId === socketId ? { ...p, isVideoOff } : p),
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
            socket.off(SocketEvent.VIDEO_CALL_PARTICIPANTS_LIST, handleParticipantsList)
            socket.off(SocketEvent.VIDEO_CALL_USER_JOINED, handleUserJoined)
            socket.off(SocketEvent.VIDEO_CALL_OFFER, handleOffer)
            socket.off(SocketEvent.VIDEO_CALL_ANSWER, handleAnswer)
            socket.off(SocketEvent.VIDEO_CALL_ICE_CANDIDATE, handleIceCandidate)
            socket.off(SocketEvent.VIDEO_CALL_USER_LEFT, handleUserLeft)
            socket.off(SocketEvent.VIDEO_CALL_MUTE_TOGGLE, handleMuteToggle)
            socket.off(SocketEvent.VIDEO_CALL_VIDEO_TOGGLE, handleVideoToggle)
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

    useEffect(() => {
        return () => {
            localStreamRef.current?.getTracks().forEach((t) => t.stop())
            localStreamRef.current = null
            const connections = [...peerConnections.current.values()]
            peerConnections.current.clear()
            pendingCandidates.current.clear()
            connections.forEach((pc) => pc.close())
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
                isRecordingCall,
                joinCall,
                leaveCall,
                toggleMute,
                toggleVideo,
                startCallRecording,
                stopCallRecording,
            }}
        >
            {children}
        </VideoCallContext.Provider>
    )
}

export { VideoCallContextProvider }
export default VideoCallContext
