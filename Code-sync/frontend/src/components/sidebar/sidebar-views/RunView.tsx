import HintPanel from "@/components/ai/HintPanel"
import { usePedagogicalAI } from "@/context/PedagogicalAIContext"
import { useRunCode } from "@/context/RunCodeContext"
import { useSettings } from "@/context/SettingContext"
import { useFileSystem } from "@/context/FileContext"
import useResponsive from "@/hooks/useResponsive"
import { ChangeEvent } from "react"
import toast from "react-hot-toast"
import { LuCopy } from "react-icons/lu"
import { PiCaretDownBold } from "react-icons/pi"
import { PiStudent } from "react-icons/pi"

// Heuristic: does the output look like a compiler/runtime error?
function looksLikeError(output: string): boolean {
    if (!output || !output.trim()) return false
    const errorPatterns = [
        /error:/i,
        /traceback/i,
        /exception/i,
        /syntaxerror/i,
        /nameerror/i,
        /typeerror/i,
        /valueerror/i,
        /indexerror/i,
        /attributeerror/i,
        /referenceerror/i,
        /rangeerror/i,
        /cannot find symbol/i,
        /undefined is not/i,
        /is not defined/i,
        /segmentation fault/i,
        /null pointer/i,
        /failed to compile/i,
        /compilation failed/i,
        /line \d+/i,
        /^\s*\^\s*$/m,              // Python caret pointer
        /at \w+\.\w+\(/,            // Java/JS stack frame
        /File ".*", line \d+/,      // Python traceback
    ]
    return errorPatterns.some((p) => p.test(output))
}

function RunView() {
    const { viewHeight } = useResponsive()
    const {
        setInput,
        output,
        isRunning,
        supportedLanguages,
        selectedLanguage,
        setSelectedLanguage,
        runCode,
    } = useRunCode()
    const { language } = useSettings()
    const { activeFile } = useFileSystem()
    const { analyzeError, hasError, clearHints } = usePedagogicalAI()

    const isError = looksLikeError(output)

    const handleLanguageChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const lang = JSON.parse(e.target.value)
        setSelectedLanguage(lang)
    }

    const copyOutput = () => {
        navigator.clipboard.writeText(output)
        toast.success("Output copied to clipboard")
    }

    const handleAnalyzeError = () => {
        const code = activeFile?.content ?? ""
        analyzeError(output, code, selectedLanguage.language || language)
    }

    return (
        <div
            className="flex flex-col items-center gap-2 p-4"
            style={{ height: viewHeight, overflowY: "auto" }}
        >
            <h1 className="view-title">Run Code</h1>
            <div className="flex w-full flex-col items-end gap-2">
                {/* Language selector */}
                <div className="relative w-full">
                    <select
                        className="w-full rounded-md border-none bg-darkHover px-4 py-2 text-white outline-none"
                        value={JSON.stringify(selectedLanguage)}
                        onChange={handleLanguageChange}
                    >
                        {supportedLanguages
                            .sort((a, b) => (a.language > b.language ? 1 : -1))
                            .map((lang, i) => (
                                <option key={i} value={JSON.stringify(lang)}>
                                    {lang.language +
                                        (lang.version ? ` (${lang.version})` : "")}
                                </option>
                            ))}
                    </select>
                    <PiCaretDownBold
                        size={16}
                        className="absolute bottom-3 right-4 z-10 text-white"
                    />
                </div>

                {/* stdin input */}
                <textarea
                    className="min-h-[80px] w-full resize-none rounded-md border-none bg-darkHover p-2 text-white outline-none"
                    placeholder="Write your input here..."
                    onChange={(e) => setInput(e.target.value)}
                />

                {/* Run button */}
                <button
                    className="flex w-full justify-center rounded-md bg-primary p-2 font-bold text-black outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => { clearHints(); runCode() }}
                    disabled={isRunning}
                >
                    Run
                </button>

                {/* Output header */}
                <label className="flex w-full justify-between">
                    <span className="flex items-center gap-2">
                        Output
                        {isError && (
                            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
                                Error detected
                            </span>
                        )}
                    </span>
                    <button onClick={copyOutput} title="Copy Output">
                        <LuCopy size={18} className="cursor-pointer text-white" />
                    </button>
                </label>

                {/* Output box */}
                <div
                    className={`w-full resize-none overflow-y-auto rounded-md border-none p-2 text-white outline-none ${
                        isError ? "bg-red-950/40 ring-1 ring-red-500/30" : "bg-darkHover"
                    }`}
                    style={{ minHeight: "80px", maxHeight: "180px" }}
                >
                    <code>
                        <pre className={`text-wrap text-sm ${isError ? "text-red-300" : ""}`}>
                            {output}
                        </pre>
                    </code>
                </div>

                {/* Analyze Error button — only shown when output looks like an error */}
                {isError && !hasError && (
                    <button
                        onClick={handleAnalyzeError}
                        className="flex w-full items-center justify-center gap-2 rounded-md bg-primary/10 py-2 text-sm font-semibold text-primary ring-1 ring-primary/30 transition-colors hover:bg-primary/20"
                    >
                        <PiStudent size={18} />
                        Analyze Error with AI Tutor
                    </button>
                )}

                {/* Hint panel — shown after analysis */}
                {hasError && <HintPanel />}
            </div>
        </div>
    )
}

export default RunView
