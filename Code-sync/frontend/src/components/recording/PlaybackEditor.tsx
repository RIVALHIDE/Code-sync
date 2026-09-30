import { useRecording } from "@/context/RecordingContext"
import { useSettings } from "@/context/SettingContext"
import { editorThemes } from "@/resources/Themes"
import { LanguageName, loadLanguage } from "@uiw/codemirror-extensions-langs"
import CodeMirror, { EditorView } from "@uiw/react-codemirror"
import { useEffect, useState } from "react"

function PlaybackEditor() {
    const { playbackEvent, currentRecording } = useRecording()
    const { theme, fontSize } = useSettings()
    const [content, setContent] = useState("")
    const [language, setLanguage] = useState("javascript")
    const [extensions, setExtensions] = useState<any[]>([
        EditorView.editable.of(false),
    ])

    // Update content when a new playback event fires
    useEffect(() => {
        if (!playbackEvent) return
        if (playbackEvent.type === "content" && playbackEvent.content !== undefined) {
            setContent(playbackEvent.content)
        }
        if (playbackEvent.fileName) {
            const ext = playbackEvent.fileName.split(".").pop() || "js"
            setLanguage(ext)
        }
    }, [playbackEvent])

    // Rebuild extensions when language changes
    useEffect(() => {
        const exts: any[] = [EditorView.editable.of(false)]
        const langExt = loadLanguage(language.toLowerCase() as LanguageName)
        if (langExt) exts.push(langExt)
        setExtensions(exts)
    }, [language])

    // Reset on new recording selected
    useEffect(() => {
        if (currentRecording) {
            setContent("")
        }
    }, [currentRecording?.id])

    return (
        <div className="flex flex-col overflow-hidden rounded-lg border border-white/10">
            {/* File name bar */}
            <div className="flex items-center gap-2 border-b border-white/10 bg-darkHover px-3 py-1.5">
                <div className="h-3 w-3 rounded-full bg-primary/60" />
                <span className="text-xs text-white/50">
                    {playbackEvent?.fileName ?? "Waiting for playback..."}
                </span>
            </div>
            <CodeMirror
                value={content}
                theme={editorThemes[theme]}
                extensions={extensions}
                editable={false}
                style={{
                    fontSize: Math.max(11, fontSize - 2) + "px",
                    maxHeight: "340px",
                    overflow: "auto",
                }}
            />
        </div>
    )
}

export default PlaybackEditor
