import { Diagnostic, linter } from "@codemirror/lint"
import { EditorView } from "@codemirror/view"
import { Extension } from "@codemirror/state"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lines(code: string) {
    return code.split("\n")
}

function lineOffset(code: string, lineIndex: number): number {
    return lines(code)
        .slice(0, lineIndex)
        .reduce((acc, l) => acc + l.length + 1, 0)
}

// ─── JavaScript / TypeScript rules ───────────────────────────────────────────

function lintJS(code: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = []
    const allLines = lines(code)

    allLines.forEach((line, i) => {
        const offset = lineOffset(code, i)
        const trimmed = line.trim()

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*")) return

        // var usage
        const varMatch = line.match(/\bvar\s+/)
        if (varMatch) {
            const col = line.indexOf("var")
            diagnostics.push({
                from: offset + col,
                to: offset + col + 3,
                severity: "warning",
                message: "Avoid 'var'. Use 'const' or 'let' instead.",
            })
        }

        // == instead of ===
        const looseEqMatch = [...line.matchAll(/(?<![=!<>])={2}(?!=)/g)]
        looseEqMatch.forEach((m) => {
            if (m.index !== undefined) {
                diagnostics.push({
                    from: offset + m.index,
                    to: offset + m.index + 2,
                    severity: "warning",
                    message: "Use '===' instead of '==' for strict equality.",
                })
            }
        })

        // != instead of !==
        const looseNeqMatch = [...line.matchAll(/!=(?!=)/g)]
        looseNeqMatch.forEach((m) => {
            if (m.index !== undefined) {
                diagnostics.push({
                    from: offset + m.index,
                    to: offset + m.index + 2,
                    severity: "warning",
                    message: "Use '!==' instead of '!=' for strict inequality.",
                })
            }
        })

        // console.log left in code
        const consoleMatch = line.match(/console\.(log|warn|error|info|debug)\s*\(/)
        if (consoleMatch && consoleMatch.index !== undefined) {
            diagnostics.push({
                from: offset + consoleMatch.index,
                to: offset + consoleMatch.index + consoleMatch[0].length,
                severity: "info",
                message: "Remove 'console' statements before production.",
            })
        }

        // debugger statement
        const debuggerMatch = line.match(/\bdebugger\b/)
        if (debuggerMatch && debuggerMatch.index !== undefined) {
            diagnostics.push({
                from: offset + debuggerMatch.index,
                to: offset + debuggerMatch.index + 8,
                severity: "error",
                message: "'debugger' statement should not be in production code.",
            })
        }

        // alert() usage
        const alertMatch = line.match(/\balert\s*\(/)
        if (alertMatch && alertMatch.index !== undefined) {
            diagnostics.push({
                from: offset + alertMatch.index,
                to: offset + alertMatch.index + alertMatch[0].length,
                severity: "warning",
                message: "Avoid 'alert()'. Use proper UI notifications instead.",
            })
        }

        // Missing semicolon (simple heuristic: statement lines not ending with ; { } , ) ] )
        const noSemiNeeded = /^(if|else|for|while|switch|function|class|try|catch|finally|\/\/|\/\*|\*|import|export\s+default\s+(function|class))\b/
        const endNeedsSemi = /^[^{}].*[^;{},\s]$/
        const isSemiStatement =
            !noSemiNeeded.test(trimmed) &&
            !trimmed.endsWith("{") &&
            !trimmed.endsWith("}") &&
            !trimmed.endsWith(",") &&
            !trimmed.endsWith("(") &&
            !trimmed.endsWith(")") &&
            !trimmed.endsWith("[") &&
            !trimmed.endsWith("]") &&
            !trimmed.endsWith("\\") &&
            !trimmed.startsWith("//") &&
            !trimmed.startsWith("*") &&
            endNeedsSemi.test(trimmed) &&
            !trimmed.endsWith(";")

        if (isSemiStatement) {
            const lineEnd = offset + line.length
            diagnostics.push({
                from: lineEnd - 1,
                to: lineEnd,
                severity: "info",
                message: "Missing semicolon at end of statement.",
            })
        }

        // Trailing whitespace
        if (line !== line.trimEnd()) {
            const trailStart = line.trimEnd().length
            diagnostics.push({
                from: offset + trailStart,
                to: offset + line.length,
                severity: "info",
                message: "Trailing whitespace.",
            })
        }

        // Long lines (> 100 chars)
        if (line.length > 100) {
            diagnostics.push({
                from: offset + 100,
                to: offset + line.length,
                severity: "info",
                message: `Line exceeds 100 characters (${line.length} chars). Consider breaking it up.`,
            })
        }

        // TODO / FIXME comments
        const todoMatch = line.match(/\/\/\s*(TODO|FIXME|HACK|XXX)\b/i)
        if (todoMatch && todoMatch.index !== undefined) {
            diagnostics.push({
                from: offset + todoMatch.index,
                to: offset + line.length,
                severity: "info",
                message: `${todoMatch[1].toUpperCase()} comment — remember to address this.`,
            })
        }
    })

    return diagnostics
}

// ─── Python rules ─────────────────────────────────────────────────────────────

function lintPython(code: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = []
    const allLines = lines(code)

    allLines.forEach((line, i) => {
        const offset = lineOffset(code, i)
        const trimmed = line.trim()

        if (!trimmed || trimmed.startsWith("#")) return

        // print statement (Python 2 style)
        const printMatch = line.match(/\bprint\s+[^(]/)
        if (printMatch && printMatch.index !== undefined) {
            diagnostics.push({
                from: offset + printMatch.index,
                to: offset + printMatch.index + 5,
                severity: "warning",
                message: "Use 'print()' function (Python 3). 'print' as a statement is Python 2.",
            })
        }

        // Comparison with None using == instead of 'is'
        const noneEqMatch = [...line.matchAll(/==\s*None|None\s*==/g)]
        noneEqMatch.forEach((m) => {
            if (m.index !== undefined) {
                diagnostics.push({
                    from: offset + m.index,
                    to: offset + m.index + m[0].length,
                    severity: "warning",
                    message: "Use 'is None' instead of '== None'.",
                })
            }
        })

        // Comparison with True/False using == instead of 'is'
        const boolEqMatch = [...line.matchAll(/==\s*(True|False)|(True|False)\s*==/g)]
        boolEqMatch.forEach((m) => {
            if (m.index !== undefined) {
                diagnostics.push({
                    from: offset + m.index,
                    to: offset + m.index + m[0].length,
                    severity: "warning",
                    message: "Use 'is True' / 'is False' or direct boolean evaluation.",
                })
            }
        })

        // Mutable default argument
        const mutableDefault = line.match(/def\s+\w+\s*\(.*=\s*(\[\]|\{\}|set\(\))/)
        if (mutableDefault && mutableDefault.index !== undefined) {
            diagnostics.push({
                from: offset + mutableDefault.index,
                to: offset + line.length,
                severity: "warning",
                message: "Avoid mutable default arguments. Use 'None' and set inside function.",
            })
        }

        // Bare except
        const bareExcept = line.match(/\bexcept\s*:/)
        if (bareExcept && bareExcept.index !== undefined) {
            diagnostics.push({
                from: offset + bareExcept.index,
                to: offset + bareExcept.index + bareExcept[0].length,
                severity: "warning",
                message: "Avoid bare 'except:'. Catch specific exceptions instead.",
            })
        }

        // Line too long (PEP 8: 79 chars)
        if (line.length > 79) {
            diagnostics.push({
                from: offset + 79,
                to: offset + line.length,
                severity: "info",
                message: `Line exceeds PEP 8 limit of 79 characters (${line.length} chars).`,
            })
        }

        // Trailing whitespace
        if (line !== line.trimEnd()) {
            const trailStart = line.trimEnd().length
            diagnostics.push({
                from: offset + trailStart,
                to: offset + line.length,
                severity: "info",
                message: "Trailing whitespace.",
            })
        }

        // TODO / FIXME
        const todoMatch = line.match(/#\s*(TODO|FIXME|HACK|XXX)\b/i)
        if (todoMatch && todoMatch.index !== undefined) {
            diagnostics.push({
                from: offset + todoMatch.index,
                to: offset + line.length,
                severity: "info",
                message: `${todoMatch[1].toUpperCase()} comment — remember to address this.`,
            })
        }
    })

    return diagnostics
}

// ─── CSS rules ────────────────────────────────────────────────────────────────

function lintCSS(code: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = []
    const allLines = lines(code)

    allLines.forEach((line, i) => {
        const offset = lineOffset(code, i)
        const trimmed = line.trim()

        if (!trimmed || trimmed.startsWith("/*") || trimmed.startsWith("*")) return

        // !important usage
        const importantMatch = line.match(/!important/)
        if (importantMatch && importantMatch.index !== undefined) {
            diagnostics.push({
                from: offset + importantMatch.index,
                to: offset + importantMatch.index + 10,
                severity: "warning",
                message: "Avoid '!important'. Increase selector specificity instead.",
            })
        }

        // Zero with unit
        const zeroUnitMatch = [...line.matchAll(/\b0(px|em|rem|%|vh|vw|pt|pc)\b/g)]
        zeroUnitMatch.forEach((m) => {
            if (m.index !== undefined) {
                diagnostics.push({
                    from: offset + m.index,
                    to: offset + m.index + m[0].length,
                    severity: "info",
                    message: `Use '0' instead of '${m[0]}' — units are unnecessary for zero values.`,
                })
            }
        })

        // Missing semicolon in property declarations
        const propMatch = line.match(/^\s*[\w-]+\s*:[^;{]+[^;{}\s]$/)
        if (propMatch) {
            diagnostics.push({
                from: offset + line.length - 1,
                to: offset + line.length,
                severity: "warning",
                message: "Missing semicolon at end of CSS declaration.",
            })
        }
    })

    return diagnostics
}

// ─── HTML rules ──────────────────────────────────────────────────────────────

function lintHTML(code: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = []
    const allLines = lines(code)

    allLines.forEach((line, i) => {
        const offset = lineOffset(code, i)

        // Inline styles
        const inlineStyle = line.match(/style\s*=\s*["'][^"']+["']/)
        if (inlineStyle && inlineStyle.index !== undefined) {
            diagnostics.push({
                from: offset + inlineStyle.index,
                to: offset + inlineStyle.index + inlineStyle[0].length,
                severity: "info",
                message: "Avoid inline styles. Use CSS classes instead.",
            })
        }

        // Images missing alt attribute
        const imgNoAlt = line.match(/<img(?![^>]*\balt\b)[^>]*>/i)
        if (imgNoAlt && imgNoAlt.index !== undefined) {
            diagnostics.push({
                from: offset + imgNoAlt.index,
                to: offset + imgNoAlt.index + imgNoAlt[0].length,
                severity: "error",
                message: "Image is missing 'alt' attribute. Required for accessibility (WCAG).",
            })
        }

        // Deprecated tags
        const deprecatedTags = ["<font", "<center", "<marquee", "<blink", "<strike", "<big", "<tt"]
        deprecatedTags.forEach((tag) => {
            const idx = line.toLowerCase().indexOf(tag)
            if (idx !== -1) {
                diagnostics.push({
                    from: offset + idx,
                    to: offset + idx + tag.length,
                    severity: "warning",
                    message: `'${tag}>' is a deprecated HTML tag. Use CSS or modern equivalents.`,
                })
            }
        })

        // onclick / onmouse inline event handlers
        const inlineEvent = line.match(/\s(on\w+)\s*=\s*["']/i)
        if (inlineEvent && inlineEvent.index !== undefined) {
            diagnostics.push({
                from: offset + inlineEvent.index,
                to: offset + inlineEvent.index + inlineEvent[0].length,
                severity: "warning",
                message: `Avoid inline event handlers (${inlineEvent[1]}). Use addEventListener() instead.`,
            })
        }
    })

    return diagnostics
}

// ─── Language dispatcher ─────────────────────────────────────────────────────

function getDiagnostics(code: string, language: string): Diagnostic[] {
    const lang = language.toLowerCase()

    if (
        lang === "javascript" ||
        lang === "jsx" ||
        lang === "typescript" ||
        lang === "tsx" ||
        lang === "js" ||
        lang === "ts"
    ) {
        return lintJS(code)
    }
    if (lang === "python" || lang === "py") {
        return lintPython(code)
    }
    if (lang === "css" || lang === "scss" || lang === "sass" || lang === "less") {
        return lintCSS(code)
    }
    if (lang === "html" || lang === "xml") {
        return lintHTML(code)
    }

    return []
}

// ─── CodeMirror extension ─────────────────────────────────────────────────────

export function createLintExtension(language: string): Extension {
    return linter(
        (view: EditorView): Diagnostic[] => {
            const code = view.state.doc.toString()
            return getDiagnostics(code, language)
        },
        {
            delay: 400, // ms debounce after last keystroke
        },
    )
}
