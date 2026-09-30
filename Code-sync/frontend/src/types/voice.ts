/**
 * Voice-to-Code Type Definitions
 * 
 * This file contains all TypeScript types and interfaces for the voice input feature.
 */

/**
 * Supported voice commands that can be spoken and converted to text
 */
export type VoiceCommand = 
  | "new line" 
  | "tab" 
  | "open bracket" 
  | "close bracket" 
  | "semicolon"

/**
 * Special actions triggered by voice commands (like undo)
 */
export type VoiceAction = "UNDO" | "REDO"

/**
 * Result returned from the voice command parser
 */
export interface ParseResult {
  /** The processed text with commands replaced by actual characters */
  text: string
  /** Array of special actions to execute (e.g., UNDO, REDO) */
  actions: VoiceAction[]
}

/**
 * Return type for the useVoiceToCode custom hook
 */
export interface UseVoiceToCodeReturn {
  /** Whether voice recording is currently active */
  isRecording: boolean
  /** Whether the browser supports Web Speech API */
  isSupported: boolean
  /** Current error message, if any */
  error: string | null
  /** Current transcript from speech recognition (interim + final) */
  transcript: string
  /** Function to start voice recording */
  startRecording: () => void
  /** Function to stop voice recording */
  stopRecording: () => void
}

/**
 * Error types from the Speech Recognition API
 */
export type VoiceToCodeError = 
  | "no-speech"              // No speech was detected
  | "audio-capture"          // No microphone found or audio capture failed
  | "not-allowed"            // Microphone permission denied
  | "network"                // Network error occurred
  | "aborted"                // Recognition was aborted
  | "language-not-supported" // Language not supported
  | "unknown"                // Unknown error occurred
