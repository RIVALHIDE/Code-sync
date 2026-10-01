import { useFileSystem } from "@/context/FileContext"
import {
    PROJECT_TEMPLATES,
    TEMPLATE_CATEGORIES,
    ProjectTemplate,
} from "@/utils/projectTemplates"
import { useEffect, useRef, useState } from "react"
import { LuX, LuFolderOpen } from "react-icons/lu"
import toast from "react-hot-toast"

interface NewProjectModalProps {
    onClose: () => void
}

function NewProjectModal({ onClose }: NewProjectModalProps) {
    const { updateDirectory } = useFileSystem()
    const [activeCategory, setActiveCategory] = useState<string>("all")
    const [selected, setSelected] = useState<ProjectTemplate | null>(null)
    const backdropRef = useRef<HTMLDivElement>(null)

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose()
        }
        document.addEventListener("keydown", handler)
        return () => document.removeEventListener("keydown", handler)
    }, [onClose])

    const filtered =
        activeCategory === "all"
            ? PROJECT_TEMPLATES
            : PROJECT_TEMPLATES.filter((t) => t.category === activeCategory)

    const handleCreate = () => {
        if (!selected) return
        const confirmed = confirm(
            `Create "${selected.label}" project? This will replace the current file tree.`,
        )
        if (!confirmed) return
        updateDirectory("", selected.children)
        toast.success(`"${selected.label}" project created`)
        onClose()
    }

    return (
        <div
            ref={backdropRef}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={(e) => {
                if (e.target === backdropRef.current) onClose()
            }}
            role="dialog"
            aria-modal="true"
            aria-label="New project"
        >
            <div className="flex h-[540px] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-darkHover bg-dark shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-darkHover px-5 py-3">
                    <div className="flex items-center gap-2">
                        <LuFolderOpen size={18} className="text-primary" />
                        <h2 className="text-sm font-semibold text-white">
                            New Project
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded p-1 text-gray-400 hover:bg-darkHover hover:text-white transition-colors"
                        aria-label="Close"
                    >
                        <LuX size={16} />
                    </button>
                </div>

                {/* Category tabs */}
                <div className="flex gap-1 overflow-x-auto border-b border-darkHover px-4 py-2">
                    <CategoryPill
                        label="All"
                        icon="✨"
                        active={activeCategory === "all"}
                        onClick={() => setActiveCategory("all")}
                    />
                    {TEMPLATE_CATEGORIES.map((c) => (
                        <CategoryPill
                            key={c.id}
                            label={c.label}
                            icon={c.icon}
                            active={activeCategory === c.id}
                            onClick={() => setActiveCategory(c.id)}
                        />
                    ))}
                </div>

                {/* Template grid */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {filtered.map((t) => (
                            <TemplateCard
                                key={t.id}
                                template={t}
                                isSelected={selected?.id === t.id}
                                onSelect={() =>
                                    setSelected((prev) =>
                                        prev?.id === t.id ? null : t,
                                    )
                                }
                            />
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-darkHover px-5 py-3">
                    <p className="text-xs text-gray-400">
                        {selected
                            ? `Selected: ${selected.label}`
                            : "Select a template to continue"}
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="rounded-md px-4 py-1.5 text-sm text-gray-400 hover:bg-darkHover hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={!selected}
                            className="rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-dark transition-opacity disabled:opacity-40 hover:opacity-90"
                        >
                            Create Project
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function CategoryPill({
    label,
    icon,
    active,
    onClick,
}: {
    label: string
    icon: string
    active: boolean
    onClick: () => void
}) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                active
                    ? "bg-primary/20 text-primary"
                    : "text-gray-400 hover:bg-darkHover hover:text-white"
            }`}
        >
            <span>{icon}</span>
            {label}
        </button>
    )
}

function TemplateCard({
    template,
    isSelected,
    onSelect,
}: {
    template: ProjectTemplate
    isSelected: boolean
    onSelect: () => void
}) {
    return (
        <button
            onClick={onSelect}
            className={`flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-all ${
                isSelected
                    ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                    : "border-darkHover bg-darkHover/30 hover:border-gray-500 hover:bg-darkHover/60"
            }`}
        >
            <span className="text-2xl">{template.icon}</span>
            <div>
                <p className="text-sm font-semibold text-white">
                    {template.label}
                </p>
                <p className="mt-0.5 text-xs leading-snug text-gray-400">
                    {template.description}
                </p>
            </div>
        </button>
    )
}

export default NewProjectModal
