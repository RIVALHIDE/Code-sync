interface Language {
    language: string
    version: string
    aliases: string[]
}

type RunMode = "online" | "offline"
type NetworkStatus = "online" | "offline"
type PistonStatus = "unknown" | "available" | "unavailable"

interface RunContext {
    setInput: (input: string) => void
    output: string
    isRunning: boolean
    supportedLanguages: Language[]
    selectedLanguage: Language
    setSelectedLanguage: (language: Language) => void
    runCode: (mode?: RunMode) => Promise<void>
    networkStatus: NetworkStatus
    pistonStatus: PistonStatus
    lastRunMode: RunMode | null
    pythonRuntimeConfigured: boolean
    pythonRuntimeMessage: string
}

export {
    Language,
    NetworkStatus,
    PistonStatus,
    RunContext,
    RunMode,
}
