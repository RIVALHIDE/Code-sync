/**
 * Voice Command Parser Utility
 * 
 * Parses voice commands from transcript text and converts them to actual
 * text insertions or special actions (like UNDO).
 */

import { ParseResult, VoiceAction } from "@/types/voice"

/**
 * Mapping of voice commands to their text representations
 * Includes common variations for better recognition
 */
const COMMAND_MAP: Record<string, string> = {
  "new line": "\n",
  "newline": "\n",
  "line break": "\n",
  "tab": "\t",
  "open bracket": "{",
  "opening bracket": "{",
  "left bracket": "{",
  "close bracket": "}",
  "closing bracket": "}",
  "right bracket": "}",
  "semicolon": ";",
  "semi colon": ";",
}

/**
 * Voice commands that trigger special actions rather than text insertion
 */
const ACTION_COMMANDS: Record<string, VoiceAction> = {
  "undo": "UNDO",
  "redo": "REDO",
}

/**
 * Parses voice commands from a transcript string and converts them
 * to text with commands replaced and special actions extracted.
 * 
 * @param transcript - The raw transcript from speech recognition
 * @returns ParseResult with processed text and actions to execute
 * 
 * @example
 * parseVoiceCommands("function hello new line open bracket close bracket")
 * // Returns: { text: "function hello \n{}", actions: [] }
 * 
 * @example
 * parseVoiceCommands("const x equals 5 semicolon")
 * // Returns: { text: "const x equals 5 ;", actions: [] }
 * 
 * @example
 * parseVoiceCommands("undo")
 * // Returns: { text: "", actions: ["UNDO"] }
 */
export function parseVoiceCommands(transcript: string): ParseResult {
  // Handle empty or whitespace-only input
  if (!transcript || transcript.trim().length === 0) {
    return { text: "", actions: [] }
  }

  // Convert to lowercase for case-insensitive matching
  let processedText = transcript.trim()
  const actions: VoiceAction[] = []

  // First, extract and remove action commands
  const lowerText = processedText.toLowerCase()
  for (const [command, action] of Object.entries(ACTION_COMMANDS)) {
    // Use word boundaries to ensure we match complete words
    const regex = new RegExp(`\\b${command}\\b`, "gi")
    if (regex.test(lowerText)) {
      actions.push(action)
      // Remove the action command from the text
      processedText = processedText.replace(regex, "").trim()
    }
  }

  // Then, replace text commands with their corresponding characters
  for (const [command, replacement] of Object.entries(COMMAND_MAP)) {
    // Use word boundaries to match complete command phrases
    // The 'gi' flags make it case-insensitive and global
    const regex = new RegExp(`\\b${escapeRegex(command)}\\b`, "gi")
    processedText = processedText.replace(regex, replacement)
  }

  // Clean up any multiple spaces that might have been created
  processedText = processedText.replace(/\s+/g, " ").trim()

  return {
    text: processedText,
    actions,
  }
}

/**
 * Escapes special regex characters in a string
 * @param str - String to escape
 * @returns Escaped string safe for use in RegExp
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
