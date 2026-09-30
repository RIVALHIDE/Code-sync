// /**
//  * useVoiceToCode Hook
//  * 
//  * Custom React hook that encapsulates Web Speech API logic for voice-to-code feature.
//  * Handles browser compatibility, recording state, transcript accumulation, and error handling.
//  */

// import { useCallback, useEffect, useRef, useState } from "react"
// import { UseVoiceToCodeReturn, VoiceToCodeError } from "@/types/voice"

// // Extend Window interface to include webkit prefix
// declare global {
//   interface Window {
//     SpeechRecognition: typeof SpeechRecognition
//     webkitSpeechRecognition: typeof SpeechRecognition
//   }
// }

// /**
//  * Custom hook for voice-to-code functionality using Web Speech API
//  * 
//  * @returns Object containing recording state, browser support info, and control functions
//  * 
//  * @example
//  * const { isRecording, isSupported, transcript, startRecording, stopRecording, error } = useVoiceToCode()
//  * 
//  * if (!isSupported) {
//  *   return <div>Voice input not supported in this browser</div>
//  * }
//  * 
//  * return (
//  *   <button onClick={isRecording ? stopRecording : startRecording}>
//  *     {isRecording ? 'Stop' : 'Start'} Recording
//  *   </button>
//  * )
//  */
// export function useVoiceToCode(): UseVoiceToCodeReturn {
//   // State management
//   const [isRecording, setIsRecording] = useState(false)
//   const [isSupported, setIsSupported] = useState(false)
//   const [error, setError] = useState<string | null>(null)
//   const [transcript, setTranscript] = useState("")

//   // Refs to avoid re-renders and maintain instances
//   const recognitionRef = useRef<SpeechRecognition | null>(null)
//   const finalTranscriptRef = useRef("")

//   /**
//    * Check if browser supports Web Speech API
//    */
//   const checkBrowserSupport = useCallback((): boolean => {
//     return (
//       typeof window !== "undefined" &&
//       ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
//     )
//   }, [])

//   /**
//    * Initialize Speech Recognition with proper configuration
//    */
//   const initializeSpeechRecognition = useCallback(() => {
//     if (!checkBrowserSupport()) {
//       return null
//     }

//     const SpeechRecognitionAPI =
//       window.SpeechRecognition || window.webkitSpeechRecognition

//     const recognition = new SpeechRecognitionAPI()

//     // Configuration
//     recognition.continuous = true // Keep listening until stopped
//     recognition.interimResults = true // Get results while speaking
//     recognition.lang = "en-US" // Language setting
//     recognition.maxAlternatives = 1 // Only get top result

//     return recognition
//   }, [checkBrowserSupport])

//   /**
//    * Handle speech recognition result events
//    */
//   const handleResult = useCallback(
//     (event: SpeechRecognitionEvent) => {
//       let interimTranscript = ""
//       let finalTranscript = ""

//       // Process all results
//       for (let i = event.resultIndex; i < event.results.length; i++) {
//         const result = event.results[i]
//         const transcriptPart = result[0].transcript

//         if (result.isFinal) {
//           finalTranscript += transcriptPart + " "
//         } else {
//           interimTranscript += transcriptPart
//         }
//       }

//       // Update transcript with both final and interim results
//       setTranscript((prev) => {
//         const newTranscript = prev + finalTranscript + interimTranscript
//         return newTranscript.trim()
//       })
//     },
//     []
//   )

//   /**
//    * Handle speech recognition errors
//    */
//   const handleError = useCallback(
//     (event: SpeechRecognitionErrorEvent) => {
//       const errorType = event.error as VoiceToCodeError

//       switch (errorType) {
//         case "no-speech":
//           // User didn't speak, auto-restart if still recording
//           if (shouldRestartRef.current && recognitionRef.current) {
//             try {
//               recognitionRef.current.start()
//             } catch (e) {
//               // Already started, ignore
//             }
//           }
//           break

//         case "audio-capture":
//           setError("No microphone detected. Please connect a microphone.")
//           setIsRecording(false)
//           shouldRestartRef.current = false
//           break

//         case "not-allowed":
//           setError(
//             "Microphone permission denied. Please enable microphone access in your browser settings."
//           )
//           setIsRecording(false)
//           shouldRestartRef.current = false
//           break

//         case "network":
//           setError("Network error occurred. Please check your internet connection.")
//           setIsRecording(false)
//           shouldRestartRef.current = false
//           break

//         case "aborted":
//           // User stopped recording, normal flow
//           setIsRecording(false)
//           shouldRestartRef.current = false
//           break

//         case "language-not-supported":
//           setError("Language not supported. Falling back to default.")
//           break

//         default:
//           setError(`Speech recognition error: ${errorType}`)
//           setIsRecording(false)
//           shouldRestartRef.current = false
//           break
//       }
//     },
//     []
//   )

//   /**
//    * Handle recognition end event
//    */
//   const handleEnd = useCallback(() => {
//     // If we're still supposed to be recording, restart
//     if (shouldRestartRef.current && recognitionRef.current) {
//       try {
//         recognitionRef.current.start()
//       } catch (e) {
//         // Already started or error, ignore
//         setIsRecording(false)
//         shouldRestartRef.current = false
//       }
//     } else {
//       setIsRecording(false)
//     }
//   }, [])

//   /**
//    * Handle recognition start event
//    */
//   const handleStart = useCallback(() => {
//     setIsRecording(true)
//     setError(null) // Clear any previous errors
//   }, [])

//   /**
//    * Start voice recording
//    */
//   const startRecording = useCallback(() => {
//     if (!recognitionRef.current) {
//       setError("Speech recognition not initialized")
//       return
//     }

//     try {
//       setTranscript("") // Clear previous transcript
//       setError(null)
//       shouldRestartRef.current = true
//       recognitionRef.current.start()
//     } catch (e) {
//       if (e instanceof Error) {
//         if (e.message.includes("already started")) {
//           // Already recording, ignore
//           return
//         }
//         setError(`Failed to start recording: ${e.message}`)
//       } else {
//         setError("Failed to start recording")
//       }
//     }
//   }, [])

//   /**
//    * Stop voice recording
//    */
//   const stopRecording = useCallback(() => {
//     if (!recognitionRef.current) {
//       return
//     }

//     try {
//       shouldRestartRef.current = false
//       recognitionRef.current.stop()
//       setIsRecording(false)
//     } catch (e) {
//       if (e instanceof Error) {
//         setError(`Failed to stop recording: ${e.message}`)
//       } else {
//         setError("Failed to stop recording")
//       }
//     }
//   }, [])

//   /**
//    * Initialize speech recognition on mount
//    */
//   useEffect(() => {
//     const supported = checkBrowserSupport()
//     setIsSupported(supported)

//     if (!supported) {
//       setError(
//         "Voice input is not supported in your browser. Try Chrome, Edge, or Safari."
//       )
//       return
//     }

//     // Initialize recognition
//     const recognition = initializeSpeechRecognition()
//     if (!recognition) {
//       setIsSupported(false)
//       return
//     }

//     // Attach event handlers
//     recognition.onresult = handleResult
//     recognition.onerror = handleError
//     recognition.onend = handleEnd
//     recognition.onstart = handleStart

//     recognitionRef.current = recognition

//     // Cleanup on unmount
//     return () => {
//       if (recognitionRef.current) {
//         shouldRestartRef.current = false
//         try {
//           recognitionRef.current.stop()
//           recognitionRef.current.abort()
//         } catch (e) {
//           // Ignore errors during cleanup
//         }
//         recognitionRef.current = null
//       }
//     }
//   }, [
//     checkBrowserSupport,
//     initializeSpeechRecognition,
//     handleResult,
//     handleError,
//     handleEnd,
//     handleStart,
//   ])

//   return {
//     isRecording,
//     isSupported,
//     error,
//     transcript,
//     startRecording,
//     stopRecording,
//   }
// }


/**
 * useVoiceToCode Hook
 *
 * Custom React hook that encapsulates Web Speech API logic for voice-to-code feature.
 * Handles browser compatibility, recording state, transcript accumulation, and error handling.
 */
/**
 * useVoiceToCode Hook
 *
 * Custom React hook that encapsulates Web Speech API logic for voice-to-code feature.
 * Handles browser compatibility, recording state, transcript accumulation, and error handling.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { UseVoiceToCodeReturn, VoiceToCodeError } from "@/types/voice"

// Extend Window interface to include webkit prefix
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}

/**
 * Custom hook for voice-to-code functionality using Web Speech API
 *
 * @returns Object containing recording state, browser support info, and control functions
 */
export function useVoiceToCode(): UseVoiceToCodeReturn {
  // State management
  const [isRecording, setIsRecording] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transcript, setTranscript] = useState("")

  // Refs to avoid re-renders and maintain instances
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const shouldRestartRef = useRef(false)
  const finalTranscriptRef = useRef("")

  /**
   * Check if browser supports Web Speech API
   */
  const checkBrowserSupport = useCallback((): boolean => {
    return (
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    )
  }, [])

  /**
   * Initialize Speech Recognition with proper configuration
   */
  const initializeSpeechRecognition = useCallback(() => {
    if (!checkBrowserSupport()) {
      return null
    }

    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition

    const recognition = new SpeechRecognitionAPI()

    // Configuration
    recognition.continuous = true // Keep listening until stopped
    recognition.interimResults = true // Get results while speaking
    recognition.lang = "en-US" // Language setting
    recognition.maxAlternatives = 1 // Only get top result

    return recognition
  }, [checkBrowserSupport])

  /**
   * Handle speech recognition result events
   */
  const handleResult = useCallback((event: SpeechRecognitionEvent) => {
    let interimTranscript = ""

    // Process all results
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      const transcriptPart = result[0].transcript

      if (result.isFinal) {
        // Final text is saved permanently (added only once)
        finalTranscriptRef.current += transcriptPart + " "
      } else {
        // Interim text is replaced every time, never added up
        interimTranscript += transcriptPart
      }
    }

    setTranscript((finalTranscriptRef.current + interimTranscript).trim())
  }, [])

  /**
   * Handle speech recognition errors
   */
  const handleError = useCallback((event: SpeechRecognitionErrorEvent) => {
    const errorType = event.error as VoiceToCodeError

    switch (errorType) {
      case "no-speech":
        // User didn't speak, auto-restart if still recording
        if (shouldRestartRef.current && recognitionRef.current) {
          try {
            recognitionRef.current.start()
          } catch (e) {
            // Already started, ignore
          }
        }
        break

      case "audio-capture":
        setError("No microphone detected. Please connect a microphone.")
        setIsRecording(false)
        shouldRestartRef.current = false
        break

      case "not-allowed":
        setError(
          "Microphone permission denied. Please enable microphone access in your browser settings."
        )
        setIsRecording(false)
        shouldRestartRef.current = false
        break

      case "network":
        setError("Network error occurred. Please check your internet connection.")
        setIsRecording(false)
        shouldRestartRef.current = false
        break

      case "aborted":
        // User stopped recording, normal flow
        setIsRecording(false)
        shouldRestartRef.current = false
        break

      case "language-not-supported":
        setError("Language not supported. Falling back to default.")
        break

      default:
        setError(`Speech recognition error: ${errorType}`)
        setIsRecording(false)
        shouldRestartRef.current = false
        break
    }
  }, [])

  /**
   * Handle recognition end event
   */
  const handleEnd = useCallback(() => {
    // If we're still supposed to be recording, restart
    if (shouldRestartRef.current && recognitionRef.current) {
      try {
        recognitionRef.current.start()
      } catch (e) {
        // Already started or error, ignore
        setIsRecording(false)
        shouldRestartRef.current = false
      }
    } else {
      setIsRecording(false)
    }
  }, [])

  /**
   * Handle recognition start event
   */
  const handleStart = useCallback(() => {
    setIsRecording(true)
    setError(null) // Clear any previous errors
  }, [])

  /**
   * Start voice recording
   */
  const startRecording = useCallback(() => {
    if (!recognitionRef.current) {
      setError("Speech recognition not initialized")
      return
    }

    try {
      setTranscript("") // Clear previous transcript
      finalTranscriptRef.current = "" // Clear saved final text
      setError(null)
      shouldRestartRef.current = true
      recognitionRef.current.start()
    } catch (e) {
      if (e instanceof Error) {
        if (e.message.includes("already started")) {
          // Already recording, ignore
          return
        }
        setError(`Failed to start recording: ${e.message}`)
      } else {
        setError("Failed to start recording")
      }
    }
  }, [])

  /**
   * Stop voice recording
   */
  const stopRecording = useCallback(() => {
    if (!recognitionRef.current) {
      return
    }

    try {
      shouldRestartRef.current = false
      recognitionRef.current.stop()
      setIsRecording(false)
    } catch (e) {
      if (e instanceof Error) {
        setError(`Failed to stop recording: ${e.message}`)
      } else {
        setError("Failed to stop recording")
      }
    }
  }, [])

  /**
   * Initialize speech recognition on mount
   */
  useEffect(() => {
    const supported = checkBrowserSupport()
    setIsSupported(supported)

    if (!supported) {
      setError(
        "Voice input is not supported in your browser. Try Chrome, Edge, or Safari."
      )
      return
    }

    // Initialize recognition
    const recognition = initializeSpeechRecognition()
    if (!recognition) {
      setIsSupported(false)
      return
    }

    // Attach event handlers
    recognition.onresult = handleResult
    recognition.onerror = handleError
    recognition.onend = handleEnd
    recognition.onstart = handleStart

    recognitionRef.current = recognition

    // Cleanup on unmount
    return () => {
      if (recognitionRef.current) {
        shouldRestartRef.current = false
        try {
          recognitionRef.current.stop()
          recognitionRef.current.abort()
        } catch (e) {
          // Ignore errors during cleanup
        }
        recognitionRef.current = null
      }
    }
  }, [
    checkBrowserSupport,
    initializeSpeechRecognition,
    handleResult,
    handleError,
    handleEnd,
    handleStart,
  ])

  return {
    isRecording,
    isSupported,
    error,
    transcript,
    startRecording,
    stopRecording,
  }
}