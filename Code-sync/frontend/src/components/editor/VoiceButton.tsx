/**
 * VoiceButton Component
 * 
 * Microphone button for voice-to-code feature.
 * Allows users to dictate code and commands using speech recognition.
 */

import { useEffect } from "react"
import { FaMicrophone, FaMicrophoneSlash } from "react-icons/fa"
import { Tooltip } from "react-tooltip"
import toast from "react-hot-toast"
import { undo } from "@codemirror/commands"
import { useVoiceToCode } from "@/hooks/useVoiceToCode"
import { useFileSystem } from "@/context/FileContext"
import { parseVoiceCommands } from "@/utils/voiceCommandParser"
import { VoiceAction } from "@/types/voice"

function VoiceButton() {
    const {
        isRecording,
        isSupported,
        error,
        transcript,
        startRecording,
        stopRecording,
    } = useVoiceToCode()

    const { activeFile, setActiveFile, editorViewRef } = useFileSystem()

    /**
     * Handle click on microphone button - toggles recording on/off
     */
    const handleClick = () => {
        if (!isSupported) {
            toast.error(
                "Voice input is not supported in your browser. Try Chrome, Edge, or Safari.",
                { duration: 4000 }
            )
            return
        }

        if (!activeFile) {
            toast.error("Please open a file first")
            return
        }

        if (isRecording) {
            stopRecording()
        } else {
            startRecording()
            toast.success("Voice input started. Speak now...")
        }
    }

    /**
     * Insert text at cursor position in the editor
     */
    const insertTextAtCursor = (processedText: string, actions: VoiceAction[]) => {
        const view = editorViewRef.current
        if (!view || !activeFile) return

        const cursorPosition = view.state.selection.main.head

        // Insert text at cursor position
        view.dispatch({
            changes: {
                from: cursorPosition,
                insert: processedText,
            },
            selection: {
                anchor: cursorPosition + processedText.length,
            },
        })

        // Get updated content from editor
        const newContent = view.state.doc.toString()

        // Update file context (this will sync to other users via socket)
        setActiveFile({ ...activeFile, content: newContent })

        // Handle special actions
        if (actions.includes("UNDO")) {
            undo(view)
        }
        if (actions.includes("REDO")) {
            // Note: redo could be implemented if needed
            toast.info("Redo not yet implemented")
        }
    }

    /**
     * Process transcript when recording stops
     */
    useEffect(() => {
        // Only process when we have a transcript and just stopped recording
        if (!isRecording && transcript.trim().length > 0) {
            // Parse voice commands from transcript
            const { text, actions } = parseVoiceCommands(transcript)

            if (text.trim().length > 0 || actions.length > 0) {
                insertTextAtCursor(text, actions)
                toast.success("Voice input inserted")
            }
        }
    }, [isRecording, transcript])

    /**
     * Show error toast when errors occur
     */
    useEffect(() => {
        if (error) {
            toast.error(error, { duration: 4000 })
        }
    }, [error])

    // Determine button state for styling
    const getButtonClass = () => {
        if (!isSupported) {
            return "text-gray-500 cursor-not-allowed opacity-50"
        }
        if (isRecording) {
            return "text-red-500 bg-red-500/10 border-2 border-red-500 animate-pulse-custom"
        }
        if (error) {
            return "text-yellow-500 border-2 border-yellow-500"
        }
        return "text-gray-400 hover:text-gray-300 hover:bg-darkHover"
    }

    // Determine tooltip content
    const getTooltipContent = () => {
        if (!isSupported) {
            return "Voice input not supported in this browser"
        }
        if (isRecording) {
            return "Recording... Click to stop"
        }
        return (
            <div className="text-center">
                <div className="font-semibold mb-1">Voice Input</div>
                <div className="text-xs">Click to start speaking</div>
                <div className="text-xs mt-1 opacity-75">
                    Commands: new line, tab, open/close bracket, semicolon, undo
                </div>
            </div>
        )
    }

    return (
        <>
            <style>
                {`
                    @keyframes pulse-custom {
                        0%, 100% {
                            transform: scale(1);
                            opacity: 1;
                        }
                        50% {
                            transform: scale(1.1);
                            opacity: 0.8;
                        }
                    }
                    
                    .animate-pulse-custom {
                        animation: pulse-custom 1.5s ease-in-out infinite;
                    }
                    
                    /* Respect user's reduced motion preference */
                    @media (prefers-reduced-motion: reduce) {
                        .animate-pulse-custom {
                            animation: none;
                        }
                    }
                    
                    .voice-button {
                        transition: all 0.2s ease-in-out;
                    }
                `}
            </style>

            <button
                onClick={handleClick}
                disabled={!isSupported}
                className={`
                    voice-button
                    flex items-center justify-center
                    w-9 h-9
                    rounded-md
                    ${getButtonClass()}
                `}
                data-tooltip-id="voice-button-tooltip"
                aria-label={isRecording ? "Stop voice input" : "Start voice input"}
            >
                {isSupported ? (
                    <FaMicrophone size={20} />
                ) : (
                    <FaMicrophoneSlash size={20} />
                )}
            </button>

            <Tooltip
                id="voice-button-tooltip"
                place="bottom"
                style={{
                    backgroundColor: "#1e1e1e",
                    color: "#fff",
                    borderRadius: "4px",
                    padding: "8px 12px",
                    fontSize: "12px",
                    maxWidth: "250px",
                    zIndex: 9999,
                }}
            >
                {getTooltipContent()}
            </Tooltip>
        </>
    )
}

export default VoiceButton
