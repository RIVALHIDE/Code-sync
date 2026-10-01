import { useFileSystem } from "@/context/FileContext"
import { FileSystemItem } from "@/types/file"
import { getIconClassName } from "@/utils/getIconClassName"
import { Icon } from "@iconify/react"
import { useEffect, useMemo, useRef, useState } from "react"
import { LuSearch, LuX, LuFileSearch } from "react-icons/lu"

// ── helpers ───────────────────────────────────────────────────────────────────

interface SearchResult {
    file: FileSystemItem
    path: string          // e.g. "src/utils/file.ts"
    matchType: "name" | "content"
    preview?: string      // snippet around the content match
    line?: number         // 1-based line number of content match
}

function collectFiles(
    node: FileSystemItem,
    pathSoFar: string,
    out: { file: FileSystemItem; path: string }[],
) {
    if (node.type === "file") {
        out.push({ file: node, path: pathSoFar || node.name })
        return
    }
    for (const child of node.children ?? []) {
        const next = pathSoFar ? `${pathSoFar}/${child.name}` : child.name
        collectFiles(child, next, out)
    }
}

function escapeRegex(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function makePreview(content: string, query: string): { preview: string; line: number } | null {
    try {
        const re = new RegExp(escapeRegex(query), "im")
        const lines = content.split("\n")
        for (let i = 0; i < lines.length; i++) {
            if (re.test(lines[i])) {
                const snippet = lines[i].trim().slice(0, 80)
                return { preview: snippet, line: i + 1 }
            }
        }
    } catch {
        // ignore regex errors
    }
    return null
}

// ── component ─────────────────────────────────────────────────────────────────

interface FileSearchPanelProps {
    onClose: () => void
}

function FileSearchPanel({ onClose }: FileSearchPanelProps) {
    const { fileStructure, openFile } = useFileSystem()
    const [query, setQuery] = useState("")
    const [searchContent, setSearchContent] = useState(false)
    const [activeIndex, setActiveIndex] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)
    const listRef = useRef<HTMLUListElement>(null)

    // Focus input on open
    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose()
        }
        document.addEventListener("keydown", handler)
        return () => document.removeEventListener("keydown", handler)
    }, [onClose])

    // Flatten all files
    const allFiles = useMemo(() => {
        const out: { file: FileSystemItem; path: string }[] = []
        collectFiles(fileStructure, "", out)
        return out
    }, [fileStructure])

    // Search
    const results: SearchResult[] = useMemo(() => {
        const q = query.trim()
        if (!q) return []

        const re = new RegExp(escapeRegex(q), "i")
        const out: SearchResult[] = []

        for (const { file, path } of allFiles) {
            if (re.test(file.name)) {
                out.push({ file, path, matchType: "name" })
            } else if (searchContent && file.content) {
                const hit = makePreview(file.content, q)
                if (hit) {
                    out.push({
                        file,
                        path,
                        matchType: "content",
                        preview: hit.preview,
                        line: hit.line,
                    })
                }
            }
        }

        return out.slice(0, 50)
    }, [query, allFiles, searchContent])

    // Reset active index when results change
    useEffect(() => {
        setActiveIndex(0)
    }, [results])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault()
            setActiveIndex((i) => Math.min(i + 1, results.length - 1))
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setActiveIndex((i) => Math.max(i - 1, 0))
        } else if (e.key === "Enter" && results[activeIndex]) {
            jumpTo(results[activeIndex])
        }
    }

    const jumpTo = (result: SearchResult) => {
        openFile(result.file.id)
        onClose()
    }

    // Scroll active item into view
    useEffect(() => {
        const el = listRef.current?.children[activeIndex] as HTMLElement | undefined
        el?.scrollIntoView({ block: "nearest" })
    }, [activeIndex])

    const highlightMatch = (text: string, q: string) => {
        const idx = text.toLowerCase().indexOf(q.toLowerCase())
        if (idx === -1 || !q) return <span>{text}</span>
        return (
            <>
                {text.slice(0, idx)}
                <mark className="bg-primary/30 text-primary rounded-sm px-0.5">
                    {text.slice(idx, idx + q.length)}
                </mark>
                {text.slice(idx + q.length)}
            </>
        )
    }

    return (
        <div className="flex flex-col border-b border-darkHover bg-dark/80">
            {/* Search input row */}
            <div className="flex items-center gap-2 px-3 py-2">
                <LuSearch size={14} className="flex-shrink-0 text-gray-400" />
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search files…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
                    aria-label="Search files"
                />
                {query && (
                    <button
                        onClick={() => setQuery("")}
                        className="text-gray-500 hover:text-white transition-colors"
                        aria-label="Clear search"
                    >
                        <LuX size={13} />
                    </button>
                )}
                <button
                    onClick={onClose}
                    className="text-gray-500 hover:text-white transition-colors"
                    aria-label="Close search"
                >
                    <LuX size={15} />
                </button>
            </div>

            {/* Search-in-content toggle */}
            <label className="flex cursor-pointer items-center gap-2 px-3 pb-2 text-xs text-gray-400">
                <input
                    type="checkbox"
                    checked={searchContent}
                    onChange={(e) => setSearchContent(e.target.checked)}
                    className="accent-primary"
                />
                Search inside files
            </label>

            {/* Results */}
            {query.trim() && (
                <ul
                    ref={listRef}
                    className="max-h-64 overflow-y-auto border-t border-darkHover"
                    role="listbox"
                    aria-label="Search results"
                >
                    {results.length === 0 ? (
                        <li className="flex flex-col items-center gap-1 py-6 text-gray-500">
                            <LuFileSearch size={22} className="opacity-40" />
                            <span className="text-xs">No files found</span>
                        </li>
                    ) : (
                        results.map((r, i) => (
                            <li
                                key={`${r.file.id}-${i}`}
                                role="option"
                                aria-selected={i === activeIndex}
                                className={`flex cursor-pointer flex-col px-3 py-2 transition-colors ${
                                    i === activeIndex
                                        ? "bg-darkHover"
                                        : "hover:bg-darkHover/50"
                                }`}
                                onClick={() => jumpTo(r)}
                                onMouseEnter={() => setActiveIndex(i)}
                            >
                                <div className="flex items-center gap-2">
                                    <Icon
                                        icon={getIconClassName(r.file.name)}
                                        fontSize={14}
                                        className="flex-shrink-0 text-gray-400"
                                    />
                                    <span className="text-xs font-medium text-white">
                                        {highlightMatch(r.file.name, query.trim())}
                                    </span>
                                    {r.matchType === "content" && r.line && (
                                        <span className="ml-auto flex-shrink-0 rounded bg-darkHover px-1 text-[10px] text-gray-400">
                                            :{r.line}
                                        </span>
                                    )}
                                </div>
                                <p className="ml-5 truncate text-[11px] text-gray-500">
                                    {r.path}
                                </p>
                                {r.preview && (
                                    <p className="ml-5 mt-0.5 truncate font-mono text-[10px] text-gray-500">
                                        {highlightMatch(r.preview, query.trim())}
                                    </p>
                                )}
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    )
}

export default FileSearchPanel
