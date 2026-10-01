import axiosInstance from "@/api/pistonApi"
import { Language, RunContext as RunContextType } from "@/types/run"
import langMap from "lang-map"
import {
    ReactNode,
    createContext,
    useContext,
    useEffect,
    useState,
} from "react"
import toast from "react-hot-toast"
import { useFileSystem } from "./FileContext"
import { useAppContext } from "./AppContext"

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000"

async function postRunAnalytics(
    roomId: string,
    username: string,
    language: string,
    fileName: string,
    success: boolean,
    errorText?: string,
) {
    try {
        await fetch(`${BACKEND_URL}/api/analytics/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomId, username, language, fileName, success, errorText }),
        })
    } catch {
        // analytics are non-critical — silent failure
    }
}

const RunCodeContext = createContext<RunContextType | null>(null)

export const useRunCode = () => {
    const context = useContext(RunCodeContext)
    if (context === null) {
        throw new Error(
            "useRunCode must be used within a RunCodeContextProvider",
        )
    }
    return context
}

const RunCodeContextProvider = ({ children }: { children: ReactNode }) => {
    const { activeFile } = useFileSystem()
    const { currentUser } = useAppContext()
    const [input, setInput] = useState<string>("")
    const [output, setOutput] = useState<string>("")
    const [isRunning, setIsRunning] = useState<boolean>(false)
    const [supportedLanguages, setSupportedLanguages] = useState<Language[]>([])
    const [selectedLanguage, setSelectedLanguage] = useState<Language>({
        language: "",
        version: "",
        aliases: [],
    })

    useEffect(() => {
        const fetchSupportedLanguages = async () => {
            try {
                const languages = await axiosInstance.get("/runtimes")
                setSupportedLanguages(languages.data)
            } catch (error: any) {
                toast.error("Failed to fetch supported languages")
                if (error?.response?.data) console.error(error?.response?.data)
            }
        }

        fetchSupportedLanguages()
    }, [])

    // Set the selected language based on the file extension
    useEffect(() => {
        if (supportedLanguages.length === 0 || !activeFile?.name) return

        const extension = activeFile.name.split(".").pop()
        if (extension) {
            const languageName = langMap.languages(extension)
            const language = supportedLanguages.find(
                (lang) =>
                    lang.aliases.includes(extension) ||
                    languageName.includes(lang.language.toLowerCase()),
            )
            if (language) setSelectedLanguage(language)
        } else setSelectedLanguage({ language: "", version: "", aliases: [] })
    }, [activeFile?.name, supportedLanguages])

    const runCode = async () => {
        try {
            if (!selectedLanguage) {
                return toast.error("Please select a language to run the code")
            } else if (!activeFile) {
                return toast.error("Please open a file to run the code")
            } else {
                toast.loading("Running code...")
            }

            setIsRunning(true)
            const { language, version } = selectedLanguage

            const response = await axiosInstance.post("/execute", {
                language,
                version,
                files: [{ name: activeFile.name, content: activeFile.content }],
                stdin: input,
            })
            if (response.data.run.stderr) {
                setOutput(response.data.run.stderr)
                await postRunAnalytics(
                    currentUser.roomId,
                    currentUser.username,
                    language,
                    activeFile.name,
                    false,
                    response.data.run.stderr,
                )
            } else {
                setOutput(response.data.run.stdout)
                await postRunAnalytics(
                    currentUser.roomId,
                    currentUser.username,
                    language,
                    activeFile.name,
                    true,
                )
            }
            setIsRunning(false)
            toast.dismiss()
        } catch (error: any) {
            console.error(error.response.data)
            console.error(error.response.data.error)
            setIsRunning(false)
            toast.dismiss()
            toast.error("Failed to run the code")
            // record a failed run even when the executor itself throws
            if (activeFile && selectedLanguage.language) {
                await postRunAnalytics(
                    currentUser.roomId,
                    currentUser.username,
                    selectedLanguage.language,
                    activeFile.name,
                    false,
                    error?.response?.data?.error ?? "Executor error",
                )
            }
        }
    }

    return (
        <RunCodeContext.Provider
            value={{
                setInput,
                output,
                isRunning,
                supportedLanguages,
                selectedLanguage,
                setSelectedLanguage,
                runCode,
            }}
        >
            {children}
        </RunCodeContext.Provider>
    )
}

export { RunCodeContextProvider }
export default RunCodeContext
