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
            className="sidebar-panel sidebar-panel--run"
            style={{ height: viewHeight }}
        >
            <div className="sidebar-panel-header">
                <h1 className="sidebar-panel-title">Run Code</h1>
            </div>
            <div className="sidebar-run-form">
                {/* Language selector */}
                <div className="sidebar-panel-field">
                    <label htmlFor="run-language">Runtime</label>
                    <select
                        id="run-language"
                        className="sidebar-panel-select"
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
                        className="sidebar-select-arrow"
                    />
                </div>

                {/* stdin input */}
                <label className="sidebar-panel-label" htmlFor="run-input">Standard input</label>
                <textarea
                    id="run-input"
                    className="sidebar-run-input"
                    placeholder="Write your input here..."
                    onChange={(e) => setInput(e.target.value)}
                />

                {/* Run button */}
                <button
                    className="sidebar-panel-button sidebar-panel-button--primary"
                    onClick={() => { clearHints(); runCode() }}
                    disabled={isRunning}
                >
                    Run
                </button>

                {/* Output header */}
                <div className="sidebar-panel-row">
                    <span className="sidebar-panel-label flex flex-wrap items-center gap-2">
                        Output
                        {isError && (
                            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
                                Error detected
                            </span>
                        )}
                    </span>
                    <button className="sidebar-panel-icon-button" onClick={copyOutput} title="Copy Output" aria-label="Copy output">
                        <LuCopy size={14} />
                    </button>
                </div>

                {/* Output box */}
                <div
                    className={`sidebar-run-output ${
                        isError ? "bg-red-950/40 ring-1 ring-red-500/30" : "bg-darkHover"
                    }`}
                    aria-label="Code output"
                >
                    <code>
                        <pre className={isError ? "text-red-300" : ""}>
                            {output}
                        </pre>
                    </code>
                </div>

                {/* Analyze Error button — only shown when output looks like an error */}
                {isError && !hasError && (
                    <button
                        onClick={handleAnalyzeError}
                        className="sidebar-panel-button sidebar-panel-button--accent"
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
