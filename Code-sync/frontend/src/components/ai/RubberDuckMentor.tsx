import {
    MentorSelection,
    usePedagogicalAI,
} from "@/context/PedagogicalAIContext"
import { FormEvent, useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import {
    LuAlertCircle,
    LuBug,
    LuChevronDown,
    LuLoader2,
    LuSend,
    LuX,
} from "react-icons/lu"
import "@/styles/rubber-duck-mentor.css"

interface RubberDuckMentorProps {
    selection: MentorSelection | null
    onDismissSelection: () => void
}

function RubberDuckMentor({
    selection,
    onDismissSelection,
}: RubberDuckMentorProps) {
    const {
        mentorMessages,
        mentorError,
        isMentorThinking,
        askMentor,
        clearMentor,
    } = usePedagogicalAI()
    const [isOpen, setIsOpen] = useState(false)
    const [question, setQuestion] = useState("")
    const questionRef = useRef<HTMLInputElement>(null)
    const panelId = "rubber-duck-mentor-panel"

    useEffect(() => {
        if (!selection) {
            setIsOpen(false)
            setQuestion("")
        }
    }, [selection])

    useEffect(() => {
        if (isOpen && selection) {
            questionRef.current?.focus()
        }
    }, [isOpen, selection])

    const openMentor = () => {
        if (!selection) return
        setIsOpen((open) => !open)
    }

    const dismissMentor = () => {
        setIsOpen(false)
        setQuestion("")
        clearMentor()
        onDismissSelection()
    }

    const submitQuestion = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!selection || !question.trim() || isMentorThinking) return

        const submittedQuestion = question
        setQuestion("")
        await askMentor(submittedQuestion, selection)
    }

    return (
        <div className="rubber-duck-mentor">
            <button
                type="button"
                className="rubber-duck-mentor__trigger"
                onClick={openMentor}
                disabled={!selection}
                aria-expanded={isOpen}
                aria-controls={panelId}
                title={
                    selection
                        ? "Ask a question about the selected code"
                        : "Select code to ask the mentor"
                }
            >
                <LuBug size={15} aria-hidden="true" />
                <span>{selection ? "Ask mentor" : "Select code to ask mentor"}</span>
                {selection && (
                    <LuChevronDown
                        size={14}
                        className={isOpen ? "rubber-duck-mentor__chevron--open" : ""}
                        aria-hidden="true"
                    />
                )}
            </button>

            {isOpen && selection && (
                <section
                    id={panelId}
                    className="rubber-duck-mentor__panel"
                    role="dialog"
                    aria-label="Rubber-duck code mentor"
                >
                    <header className="rubber-duck-mentor__header">
                        <div>
                            <h2>
                                <LuBug size={15} aria-hidden="true" />
                                Rubber-duck mentor
                            </h2>
                            <p>
                                Ask about the selected {selection.language} code.
                            </p>
                        </div>
                        <button
                            type="button"
                            className="rubber-duck-mentor__close"
                            onClick={dismissMentor}
                            aria-label="Close mentor and clear selection"
                            title="Close mentor and clear selection"
                        >
                            <LuX size={16} aria-hidden="true" />
                        </button>
                    </header>

                    <div className="rubber-duck-mentor__selection">
                        <div className="rubber-duck-mentor__selection-label">
                            <span>Selected code</span>
                            {selection.truncated && <span>Long selection shortened</span>}
                        </div>
                        <pre>
                            <code>{selection.code}</code>
                        </pre>
                    </div>

                    <div
                        className="rubber-duck-mentor__thread"
                        aria-live="polite"
                        aria-busy={isMentorThinking}
                    >
                        {mentorMessages.length === 0 && !mentorError && (
                            <p className="rubber-duck-mentor__empty">
                                I can help you talk through this code. What are you
                                wondering about?
                            </p>
                        )}

                        {mentorMessages.map((message, index) => (
                            <div
                                key={`${message.role}-${index}`}
                                className={`rubber-duck-mentor__message rubber-duck-mentor__message--${message.role}`}
                            >
                                <span className="rubber-duck-mentor__message-role">
                                    {message.role === "assistant" ? "Mentor" : "You"}
                                </span>
                                {message.role === "assistant" ? (
                                    <ReactMarkdown>{message.content}</ReactMarkdown>
                                ) : (
                                    <p>{message.content}</p>
                                )}
                            </div>
                        ))}

                        {isMentorThinking && (
                            <div className="rubber-duck-mentor__thinking" role="status">
                                <LuLoader2
                                    size={15}
                                    className="rubber-duck-mentor__spinner"
                                    aria-hidden="true"
                                />
                                Thinking about your selection…
                            </div>
                        )}

                        {mentorError && (
                            <div className="rubber-duck-mentor__error" role="alert">
                                <LuAlertCircle size={15} aria-hidden="true" />
                                <span>{mentorError}</span>
                            </div>
                        )}
                    </div>

                    <form
                        className="rubber-duck-mentor__form"
                        onSubmit={submitQuestion}
                    >
                        <label htmlFor="rubber-duck-mentor-question">
                            Your question
                        </label>
                        <div className="rubber-duck-mentor__input-row">
                            <input
                                ref={questionRef}
                                id="rubber-duck-mentor-question"
                                type="text"
                                value={question}
                                onChange={(event) => setQuestion(event.target.value)}
                                placeholder="Why isn't my loop stopping?"
                                disabled={isMentorThinking}
                                autoComplete="off"
                            />
                            <button
                                type="submit"
                                aria-label="Ask mentor"
                                title="Ask mentor"
                                disabled={
                                    isMentorThinking || !question.trim() || !selection
                                }
                            >
                                <LuSend size={15} aria-hidden="true" />
                            </button>
                        </div>
                    </form>
                </section>
            )}
        </div>
    )
}

export default RubberDuckMentor
