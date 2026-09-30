export interface LinkedCodeBlock {
    id: string
    fileId: string
    fileName: string
    code: string           // selected/full code snippet
    language: string
    linkedBy: string       // username who linked it
    linkedAt: number       // timestamp
}

export interface PromptCursor {
    username: string
    position: number       // caret offset in the shared prompt textarea
    color: string          // assigned color per user
}

export interface PromptHistoryEntry {
    id: string
    prompt: string
    linkedBlocks: LinkedCodeBlock[]
    response: string
    submittedBy: string
    timestamp: number
}

export interface CoPromptContext {
    promptText: string
    linkedBlocks: LinkedCodeBlock[]
    remoteCursors: PromptCursor[]
    isSubmitting: boolean
    aiResponse: string
    history: PromptHistoryEntry[]
    // actions
    updatePrompt: (text: string, cursorPos: number) => void
    linkCurrentFile: () => void
    unlinkBlock: (id: string) => void
    submitPrompt: () => Promise<void>
    clearPrompt: () => void
}
