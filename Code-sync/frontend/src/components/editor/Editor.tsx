import { useAppContext } from "@/context/AppContext"
import {
    MENTOR_SELECTION_LIMIT,
    MentorSelection,
    usePedagogicalAI,
} from "@/context/PedagogicalAIContext"
import { useFileSystem } from "@/context/FileContext"
import { useSettings } from "@/context/SettingContext"
import { useSocket } from "@/context/SocketContext"
import usePageEvents from "@/hooks/usePageEvents"
import { editorThemes } from "@/resources/Themes"
import { FileSystemItem } from "@/types/file"
import { SocketEvent } from "@/types/socket"
import { color } from "@uiw/codemirror-extensions-color"
import { hyperLink } from "@uiw/codemirror-extensions-hyper-link"
import { LanguageName, loadLanguage } from "@uiw/codemirror-extensions-langs"
import CodeMirror, {
    Extension,
    ViewUpdate,
    scrollPastEnd,
} from "@uiw/react-codemirror"
import { EditorView } from "@codemirror/view"
import { lintGutter } from "@codemirror/lint"
import { useEffect, useMemo, useState, useRef, useCallback } from "react"
import toast from "react-hot-toast"
import {
    collaborativeHighlighting,
    updateRemoteUsers,
} from "./collaborativeHighlighting"
import { createLintExtension } from "./linting"
import { createAutocompleteExtension } from "./autocomplete"
import { useRecording } from "@/context/RecordingContext"
import RubberDuckMentor from "@/components/ai/RubberDuckMentor"

function Editor() {
    const { users, currentUser } = useAppContext()
    const { activeFile, setActiveFile } = useFileSystem()
    const { theme, language, fontSize, fontFamily, enableLinting } =
        useSettings()
    const { socket } = useSocket()
    const { captureEvent, recordingState } = useRecording()
    const { clearMentor, mentorSelection: submittedMentorSelection } =
        usePedagogicalAI()
    const [timeOut, setTimeOut] = useState(setTimeout(() => {}, 0))
    const filteredUsers = useMemo(
        () => users.filter((u) => u.username !== currentUser.username),
        [users, currentUser],
    )
    const [extensions, setExtensions] = useState<Extension[]>([])
    const editorRef = useRef<any>(null)
    const [lastCursorPosition, setLastCursorPosition] = useState<number>(0)
    const [lastSelection, setLastSelection] = useState<{
        start?: number
        end?: number
    }>({})
    const [mentorSelection, setMentorSelection] =
        useState<MentorSelection | null>(null)
    const cursorMoveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    )

    const onCodeChange = (code: string, view: ViewUpdate) => {
        if (!activeFile) return

        const file: FileSystemItem = { ...activeFile, content: code }
        setActiveFile(file)

        // Get cursor position and selection range
        const selection = view.state?.selection?.main
        const cursorPosition = selection?.head || 0
        const selectionStart = selection?.from
        const selectionEnd = selection?.to

        // Capture keystroke event for session recording
        if (recordingState === "recording") {
            captureEvent({
                type: "content",
                fileId: activeFile.id,
                fileName: activeFile.name,
                content: code,
                cursorPosition,
                selectionStart,
                selectionEnd,
            })
        }

        // Emit cursor and selection data
        socket.emit(SocketEvent.TYPING_START, {
            cursorPosition,
            selectionStart,
            selectionEnd,
        })
        socket.emit(SocketEvent.FILE_UPDATED, {
            fileId: activeFile.id,
            newContent: code,
        })
        clearTimeout(timeOut)

        const newTimeOut = setTimeout(
            () => socket.emit(SocketEvent.TYPING_PAUSE),
            1000,
        )
        setTimeOut(newTimeOut)
    }

    // Handle cursor/selection changes without typing
    const handleSelectionChange = useCallback(
        (view: ViewUpdate) => {
            if (!view.selectionSet) return

            const selection = view.state?.selection?.main
            const cursorPosition = selection?.head || 0
            const selectionStart = selection?.from
            const selectionEnd = selection?.to
            const selectedText =
                activeFile?.id &&
                selectionStart !== undefined &&
                selectionEnd !== undefined &&
                selectionEnd > selectionStart
                    ? view.state.sliceDoc(selectionStart, selectionEnd)
                    : ""
            const nextMentorSelection =
                activeFile && selectedText.trim().length > 0
                    ? {
                          code: selectedText.slice(0, MENTOR_SELECTION_LIMIT),
                          language,
                          fileId: activeFile.id,
                          truncated: selectedText.length > MENTOR_SELECTION_LIMIT,
                      }
                    : null
            const mentorSelectionChanged =
                (nextMentorSelection?.code ?? "") !==
                    (mentorSelection?.code ?? "") ||
                nextMentorSelection?.language !== mentorSelection?.language ||
                nextMentorSelection?.fileId !== mentorSelection?.fileId

            if (mentorSelectionChanged) {
                setMentorSelection(nextMentorSelection)
                if (
                    !nextMentorSelection ||
                    !submittedMentorSelection ||
                    nextMentorSelection.code !== submittedMentorSelection.code ||
                    nextMentorSelection.language !==
                        submittedMentorSelection.language ||
                    nextMentorSelection.fileId !== submittedMentorSelection.fileId
                ) {
                    clearMentor()
                }
            }

            // Check if cursor or selection actually changed
            const cursorChanged = cursorPosition !== lastCursorPosition
            const selectionChanged =
                selectionStart !== lastSelection.start ||
                selectionEnd !== lastSelection.end

            if (cursorChanged || selectionChanged) {
                setLastCursorPosition(cursorPosition)
                setLastSelection({ start: selectionStart, end: selectionEnd })

                // Clear existing timeout
                if (cursorMoveTimeoutRef.current) {
                    clearTimeout(cursorMoveTimeoutRef.current)
                }

                // Debounce cursor move events
                cursorMoveTimeoutRef.current = setTimeout(() => {
                    socket.emit(SocketEvent.CURSOR_MOVE, {
                        cursorPosition,
                        selectionStart,
                        selectionEnd,
                    })
                }, 100) // 100ms debounce
            }
        },
        [
            activeFile?.id,
            clearMentor,
            language,
            lastCursorPosition,
            lastSelection,
            mentorSelection,
            socket,
            submittedMentorSelection,
        ],
    )

    // Listen wheel event to zoom in/out and prevent page reload
    usePageEvents()

    useEffect(() => {
        const extensions = [
            color,
            hyperLink,
            collaborativeHighlighting(),
            EditorView.updateListener.of(handleSelectionChange),
            scrollPastEnd(),
            // Autocomplete + auto-brackets for all languages
            ...createAutocompleteExtension(language),
        ]

        // Add linting extensions when enabled
        if (enableLinting) {
            extensions.push(lintGutter())
            extensions.push(createLintExtension(language))
        }

        const langExt = loadLanguage(language.toLowerCase() as LanguageName)
        if (langExt) {
            extensions.push(langExt)
        } else {
            toast.error(
                "Syntax highlighting is unavailable for this language. Please adjust the editor settings; it may be listed under a different name.",
                {
                    duration: 5000,
                },
            )
        }

        setExtensions(extensions)
    }, [filteredUsers, language, handleSelectionChange, enableLinting])

    // Update remote users when filteredUsers changes
    useEffect(() => {
        if (editorRef.current?.view) {
            editorRef.current.view.dispatch({
                effects: updateRemoteUsers.of(filteredUsers),
            })
        }
    }, [filteredUsers])

    // A selection belongs to the active file and language. Clear it when either changes.
    useEffect(() => {
        setMentorSelection(null)
        clearMentor()
    }, [activeFile?.id, clearMentor, language])

    // Capture file-switch events during recording
    useEffect(() => {
        if (recordingState === "recording" && activeFile) {
            captureEvent({
                type: "file-switch",
                fileId: activeFile.id,
                fileName: activeFile.name,
                content: activeFile.content ?? "",
            })
        }
        // Only fire when the active file id changes, not on every content update
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeFile?.id, recordingState])

    return (
        <div className="editor-with-mentor">
            <CodeMirror
                ref={editorRef}
                theme={editorThemes[theme]}
                onChange={onCodeChange}
                value={activeFile?.content}
                extensions={extensions}
                height="100%"
                className="workspace-codemirror"
                style={{
                    fontSize: fontSize + "px",
                    fontFamily: `${fontFamily}, monospace`,
                    height: "100%",
                }}
            />
            <RubberDuckMentor
                selection={mentorSelection}
                onDismissSelection={() => {
                    setMentorSelection(null)
                    clearMentor()
                }}
            />
        </div>
    )
}

export default Editor
