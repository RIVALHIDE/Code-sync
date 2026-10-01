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

const ICE_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
    ],
}

// Per-peer state for perfect negotiation
interface PeerState {
    pc: RTCPeerConnection
    makingOffer: boolean
    ignoreOffer: boolean
    polite: boolean   // polite peer defers when collision happens
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

    const localStreamRef = useRef<MediaStream | null>(null)
    // Map socketId → PeerState
    const peers = useRef<Map<string, PeerState>>(new Map())

    // Video recording refs
    const callMediaRecorder = useRef<MediaRecorder | null>(null)
    const callRecordingChunks = useRef<Blob[]>([])

    // ── Create peer connection with Perfect Negotiation ────────────────────────
    const createPeer = useCallback(
        (remoteSocketId: string, remoteUsername: string, polite: boolean): PeerState => {
            // Close existing if any
            const existing = peers.current.get(remoteSocketId)
            if (existing) {
                existing.pc.close()
                peers.current.delete(remoteSocketId)
            }

            const pc = new RTCPeerConnection(ICE_SERVERS)
            const state: PeerState = { pc, makingOffer: false, ignoreOffer: false, polite }
            peers.current.set(remoteSocketId, state)

            // Add local tracks
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => {
                    pc.addTrack(track, localStreamRef.current!)
                })
            }

            // Remote track → update participant stream
            pc.ontrack = ({ streams: [remoteStream] }) => {
                setParticipants((prev) => {
                    const existing = prev.find((p) => p.socketId === remoteSocketId)
                    if (existing) {
                        return prev.map((p) =>
                            p.socketId === remoteSocketId ? { ...p, stream: remoteStream } : p,
                        )
                    }
                    return [
                        ...prev,
                        { socketId: remoteSocketId, username: remoteUsername, stream: remoteStream, isMuted: false, isVideoOff: false },
                    ]
                })
            }

            // ICE candidates
            pc.onicecandidate = ({ candidate }) => {
                if (candidate) {
                    socket.emit(SocketEvent.VIDEO_CALL_ICE_CANDIDATE, {
                        targetSocketId: remoteSocketId,
                        candidate,
                    })
                }
            }

            // Perfect negotiation — negotiationneeded fires when tracks added
            pc.onnegotiationneeded = async () => {
                try {
                    state.makingOffer = true
                    await pc.setLocalDescription()
                    socket.emit(SocketEvent.VIDEO_CALL_OFFER, {
                        targetSocketId: remoteSocketId,
                        offer: pc.localDescription,
                    })
                } catch (err) {
                    console.error("[PeerConn] negotiationneeded error:", err)
                } finally {
                    state.makingOffer = false
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
                    peers.current.delete(remoteSocketId)
                }
            }

            return state
        },
        [socket],
    )

    // ── Join call ──────────────────────────────────────────────────────────────
    const joinCall = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            localStreamRef.current = stream
            setLocalStream(stream)
            setIsInCall(true)
            socket.emit(SocketEvent.VIDEO_CALL_USER_JOINED, { username: currentUser.username })
            toast.success("Joined the video call")
        } catch (err) {
            console.error("getUserMedia failed:", err)
            toast.error("Could not access camera/microphone. Check permissions.")
        }
    }, [socket, currentUser.username])

    // ── Leave call ─────────────────────────────────────────────────────────────
    const leaveCall = useCallback(() => {
        // Stop call recording if active
        if (callMediaRecorder.current?.state !== "inactive") {
            callMediaRecorder.current?.stop()
        }
        localStreamRef.current?.getTracks().forEach((t) => t.stop())
        localStreamRef.current = null
        setLocalStream(null)
        peers.current.forEach(({ pc }) => pc.close())
        peers.current.clear()
        setParticipants([])
        setIsInCall(false)
        setIsMuted(false)
        setIsVideoOff(false)
        setIsRecordingCall(false)
        socket.emit(SocketEvent.VIDEO_CALL_USER_LEFT)
        toast.success("Left the video call")
    }, [socket])

    // ── Toggle mute ────────────────────────────────────────────────────────────
    const toggleMute = useCallback(() => {
        const track = localStreamRef.current?.getAudioTracks()[0]
        if (!track) return
        track.enabled = !track.enabled
        setIsMuted(!track.enabled)
        socket.emit(SocketEvent.VIDEO_CALL_MUTE_TOGGLE, { isMuted: !track.enabled })
    }, [socket])

    // ── Toggle video ───────────────────────────────────────────────────────────
    const toggleVideo = useCallback(() => {
        const track = localStreamRef.current?.getVideoTracks()[0]
        if (!track) return
        track.enabled = !track.enabled
        setIsVideoOff(!track.enabled)
        socket.emit(SocketEvent.VIDEO_CALL_VIDEO_TOGGLE, { isVideoOff: !track.enabled })
    }, [socket])

    // ── Record call ────────────────────────────────────────────────────────────
    const startCallRecording = useCallback(() => {
        if (!localStreamRef.current) return
        callRecordingChunks.current = []

        // Combine local + all remote streams into one canvas-based stream
        // Simpler approach: just record local stream + audio from all peers
        const tracks: MediaStreamTrack[] = []

        // Local video + audio
        localStreamRef.current.getTracks().forEach((t) => tracks.push(t))

        // Remote audio tracks
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

    // ── Socket: existing participants list (sent to new joiner) ────────────────
    const handleParticipantsList = useCallback(
        async ({ participants: list }: { participants: Array<{ socketId: string; username: string }> }) => {
            if (!localStreamRef.current) return
            for (const p of list) {
                setParticipants((prev) => {
                    if (prev.find((x) => x.socketId === p.socketId)) return prev
                    return [...prev, { socketId: p.socketId, username: p.username, stream: null, isMuted: false, isVideoOff: false }]
                })
                // New joiner is IMPOLITE (they initiate)
                createPeer(p.socketId, p.username, false)
                // onnegotiationneeded will fire and send the offer automatically
            }
        },
        [createPeer],
    )

    // ── Socket: someone joined (sent to existing participants) ─────────────────
    const handleUserJoined = useCallback(
        ({ socketId, username }: { socketId: string; username: string }) => {
            if (!localStreamRef.current) return
            setParticipants((prev) => {
                if (prev.find((p) => p.socketId === socketId)) return prev
                return [...prev, { socketId, username, stream: null, isMuted: false, isVideoOff: false }]
            })
            // Existing participant is POLITE (they defer on collision)
            createPeer(socketId, username, true)
            // onnegotiationneeded fires and sends offer — polite peer will rollback if needed
        },
        [createPeer],
    )

    // ── Socket: received offer (Perfect Negotiation) ───────────────────────────
    const handleOffer = useCallback(
        async ({ senderSocketId, senderUsername, offer }: {
            senderSocketId: string
            senderUsername: string
            offer: RTCSessionDescriptionInit
        }) => {
            let peerState = peers.current.get(senderSocketId)
            if (!peerState) {
                // We haven't created a peer yet — create as polite
                setParticipants((prev) => {
                    if (prev.find((p) => p.socketId === senderSocketId)) return prev
                    return [...prev, { socketId: senderSocketId, username: senderUsername, stream: null, isMuted: false, isVideoOff: false }]
                })
                peerState = createPeer(senderSocketId, senderUsername, true)
            }

            const { pc, polite, makingOffer } = peerState
            const offerCollision =
                offer.type === "offer" &&
                (makingOffer || pc.signalingState !== "stable")

            peerState.ignoreOffer = !polite && offerCollision
            if (peerState.ignoreOffer) return

            if (offerCollision) {
                // Polite peer rolls back its own offer
                await pc.setLocalDescription({ type: "rollback" })
            }

            await pc.setRemoteDescription(new RTCSessionDescription(offer))

            if (offer.type === "offer") {
                await pc.setLocalDescription()
                socket.emit(SocketEvent.VIDEO_CALL_ANSWER, {
                    targetSocketId: senderSocketId,
                    answer: pc.localDescription,
                })
            }
        },
        [createPeer, socket],
    )

    // ── Socket: received answer ────────────────────────────────────────────────
    const handleAnswer = useCallback(
        async ({ senderSocketId, answer }: { senderSocketId: string; answer: RTCSessionDescriptionInit }) => {
            const peerState = peers.current.get(senderSocketId)
            if (!peerState || peerState.ignoreOffer) return
            try {
                await peerState.pc.setRemoteDescription(new RTCSessionDescription(answer))
            } catch (err) {
                console.error("[PeerConn] setRemoteDescription answer error:", err)
            }
        },
        [],
    )

    // ── Socket: ICE candidate ──────────────────────────────────────────────────
    const handleIceCandidate = useCallback(
        async ({ senderSocketId, candidate }: { senderSocketId: string; candidate: RTCIceCandidateInit }) => {
            const peerState = peers.current.get(senderSocketId)
            if (!peerState) return
            try {
                await peerState.pc.addIceCandidate(new RTCIceCandidate(candidate))
            } catch (err) {
                if (!peerState.ignoreOffer) console.error("[PeerConn] addIceCandidate error:", err)
            }
        },
        [],
    )

    // ── Socket: user left ──────────────────────────────────────────────────────
    const handleUserLeft = useCallback(({ socketId }: { socketId: string }) => {
        const peerState = peers.current.get(socketId)
        if (peerState) {
            peerState.pc.close()
            peers.current.delete(socketId)
        }
        setParticipants((prev) => prev.filter((p) => p.socketId !== socketId))
    }, [])

    // ── Socket: mute/video toggles ─────────────────────────────────────────────
    const handleMuteToggle = useCallback(({ socketId, isMuted }: { socketId: string; isMuted: boolean }) => {
        setParticipants((prev) => prev.map((p) => p.socketId === socketId ? { ...p, isMuted } : p))
    }, [])

    const handleVideoToggle = useCallback(({ socketId, isVideoOff }: { socketId: string; isVideoOff: boolean }) => {
        setParticipants((prev) => prev.map((p) => p.socketId === socketId ? { ...p, isVideoOff } : p))
    }, [])

    // ── Register socket listeners ──────────────────────────────────────────────
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
        handleParticipantsList, handleUserJoined, handleOffer, handleAnswer,
        handleIceCandidate, handleUserLeft, handleMuteToggle, handleVideoToggle, socket,
    ])

    // ── Cleanup on unmount ─────────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            localStreamRef.current?.getTracks().forEach((t) => t.stop())
            peers.current.forEach(({ pc }) => pc.close())
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
