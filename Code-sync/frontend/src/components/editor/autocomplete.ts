import {
    autocompletion,
    completionKeymap,
    closeBrackets,
    closeBracketsKeymap,
    CompletionContext,
    CompletionResult,
    Completion,
    snippetCompletion,
} from "@codemirror/autocomplete"
import { javascript } from "@codemirror/lang-javascript"
import { python } from "@codemirror/lang-python"
import { html } from "@codemirror/lang-html"
import { css } from "@codemirror/lang-css"
import { keymap } from "@codemirror/view"
import { Extension } from "@codemirror/state"

// ─── JS/TS Snippets ───────────────────────────────────────────────────────────

const jsSnippets: Completion[] = [
    snippetCompletion("console.log(${1})", {
        label: "console.log",
        detail: "log to console",
        type: "function",
    }),
    snippetCompletion("console.error(${1})", {
        label: "console.error",
        detail: "log error to console",
        type: "function",
    }),
    snippetCompletion("console.warn(${1})", {
        label: "console.warn",
        detail: "log warning to console",
        type: "function",
    }),
    snippetCompletion("const ${1:name} = ${2:value}", {
        label: "const",
        detail: "constant declaration",
        type: "keyword",
    }),
    snippetCompletion("let ${1:name} = ${2:value}", {
        label: "let",
        detail: "variable declaration",
        type: "keyword",
    }),
    snippetCompletion("const ${1:name} = (${2:params}) => {\n\t${3}\n}", {
        label: "arrow function",
        detail: "const fn = () => {}",
        type: "function",
    }),
    snippetCompletion("const ${1:name} = async (${2:params}) => {\n\t${3}\n}", {
        label: "async arrow function",
        detail: "const fn = async () => {}",
        type: "function",
    }),
    snippetCompletion("function ${1:name}(${2:params}) {\n\t${3}\n}", {
        label: "function",
        detail: "function declaration",
        type: "function",
    }),
    snippetCompletion("async function ${1:name}(${2:params}) {\n\t${3}\n}", {
        label: "async function",
        detail: "async function declaration",
        type: "function",
    }),
    snippetCompletion("if (${1:condition}) {\n\t${2}\n}", {
        label: "if",
        detail: "if statement",
        type: "keyword",
    }),
    snippetCompletion("if (${1:condition}) {\n\t${2}\n} else {\n\t${3}\n}", {
        label: "ifelse",
        detail: "if...else statement",
        type: "keyword",
    }),
    snippetCompletion("for (let ${1:i} = 0; ${1:i} < ${2:length}; ${1:i}++) {\n\t${3}\n}", {
        label: "for",
        detail: "for loop",
        type: "keyword",
    }),
    snippetCompletion("for (const ${1:item} of ${2:iterable}) {\n\t${3}\n}", {
        label: "forof",
        detail: "for...of loop",
        type: "keyword",
    }),
    snippetCompletion("for (const ${1:key} in ${2:object}) {\n\t${3}\n}", {
        label: "forin",
        detail: "for...in loop",
        type: "keyword",
    }),
    snippetCompletion("${1:array}.forEach((${2:item}) => {\n\t${3}\n})", {
        label: "forEach",
        detail: "array forEach",
        type: "method",
    }),
    snippetCompletion("${1:array}.map((${2:item}) => ${3})", {
        label: "map",
        detail: "array map",
        type: "method",
    }),
    snippetCompletion("${1:array}.filter((${2:item}) => ${3})", {
        label: "filter",
        detail: "array filter",
        type: "method",
    }),
    snippetCompletion("${1:array}.reduce((${2:acc}, ${3:item}) => ${4}, ${5:initial})", {
        label: "reduce",
        detail: "array reduce",
        type: "method",
    }),
    snippetCompletion("try {\n\t${1}\n} catch (${2:error}) {\n\t${3}\n}", {
        label: "try",
        detail: "try...catch block",
        type: "keyword",
    }),
    snippetCompletion("try {\n\t${1}\n} catch (${2:error}) {\n\t${3}\n} finally {\n\t${4}\n}", {
        label: "tryfin",
        detail: "try...catch...finally",
        type: "keyword",
    }),
    snippetCompletion(
        "class ${1:Name} {\n\tconstructor(${2:params}) {\n\t\t${3}\n\t}\n}",
        {
            label: "class",
            detail: "class declaration",
            type: "class",
        },
    ),
    snippetCompletion(
        "class ${1:Name} extends ${2:Base} {\n\tconstructor(${3:params}) {\n\t\tsuper(${3:params})\n\t\t${4}\n\t}\n}",
        {
            label: "classextends",
            detail: "class extends",
            type: "class",
        },
    ),
    snippetCompletion(
        "import ${1:name} from '${2:module}'",
        {
            label: "import",
            detail: "import statement",
            type: "keyword",
        },
    ),
    snippetCompletion(
        "import { ${1:name} } from '${2:module}'",
        {
            label: "importnamed",
            detail: "named import",
            type: "keyword",
        },
    ),
    snippetCompletion("export default ${1}", {
        label: "export default",
        detail: "default export",
        type: "keyword",
    }),
    snippetCompletion("export const ${1:name} = ${2}", {
        label: "export const",
        detail: "named export",
        type: "keyword",
    }),
    snippetCompletion("switch (${1:value}) {\n\tcase ${2:pattern}:\n\t\t${3}\n\t\tbreak\n\tdefault:\n\t\t${4}\n}", {
        label: "switch",
        detail: "switch statement",
        type: "keyword",
    }),
    snippetCompletion("return new Promise((resolve, reject) => {\n\t${1}\n})", {
        label: "promise",
        detail: "new Promise",
        type: "class",
    }),
    snippetCompletion("Promise.all([${1}]).then((${2:results}) => {\n\t${3}\n})", {
        label: "Promise.all",
        detail: "Promise.all",
        type: "function",
    }),
    snippetCompletion("setTimeout(() => {\n\t${1}\n}, ${2:1000})", {
        label: "setTimeout",
        detail: "setTimeout callback",
        type: "function",
    }),
    snippetCompletion("setInterval(() => {\n\t${1}\n}, ${2:1000})", {
        label: "setInterval",
        detail: "setInterval callback",
        type: "function",
    }),
    // React-specific
    snippetCompletion(
        "import { useState } from 'react'\n\nconst [${1:state}, set${1/(.*)/${1:/capitalize}/}] = useState(${2:initialValue})",
        {
            label: "useState",
            detail: "React useState hook",
            type: "function",
        },
    ),
    snippetCompletion(
        "import { useEffect } from 'react'\n\nuseEffect(() => {\n\t${1}\n\treturn () => {\n\t\t${2}\n\t}\n}, [${3}])",
        {
            label: "useEffect",
            detail: "React useEffect hook",
            type: "function",
        },
    ),
    snippetCompletion(
        "function ${1:Component}({ ${2:props} }) {\n\treturn (\n\t\t<div>\n\t\t\t${3}\n\t\t</div>\n\t)\n}\n\nexport default ${1:Component}",
        {
            label: "rfc",
            detail: "React functional component",
            type: "function",
        },
    ),
]

// ─── Python Snippets ──────────────────────────────────────────────────────────

const pySnippets: Completion[] = [
    snippetCompletion("def ${1:name}(${2:params}):\n\t${3:pass}", {
        label: "def",
        detail: "function definition",
        type: "function",
    }),
    snippetCompletion("async def ${1:name}(${2:params}):\n\t${3:pass}", {
        label: "async def",
        detail: "async function definition",
        type: "function",
    }),
    snippetCompletion("class ${1:Name}:\n\tdef __init__(self${2:, params}):\n\t\t${3:pass}", {
        label: "class",
        detail: "class definition",
        type: "class",
    }),
    snippetCompletion("class ${1:Name}(${2:Base}):\n\tdef __init__(self${3:, params}):\n\t\tsuper().__init__(${3})\n\t\t${4:pass}", {
        label: "classextends",
        detail: "class with inheritance",
        type: "class",
    }),
    snippetCompletion("if ${1:condition}:\n\t${2:pass}", {
        label: "if",
        detail: "if statement",
        type: "keyword",
    }),
    snippetCompletion("if ${1:condition}:\n\t${2:pass}\nelse:\n\t${3:pass}", {
        label: "ifelse",
        detail: "if...else statement",
        type: "keyword",
    }),
    snippetCompletion("for ${1:item} in ${2:iterable}:\n\t${3:pass}", {
        label: "for",
        detail: "for loop",
        type: "keyword",
    }),
    snippetCompletion("while ${1:condition}:\n\t${2:pass}", {
        label: "while",
        detail: "while loop",
        type: "keyword",
    }),
    snippetCompletion("try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:e}:\n\t${4:pass}", {
        label: "try",
        detail: "try...except",
        type: "keyword",
    }),
    snippetCompletion("try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:e}:\n\t${4:pass}\nfinally:\n\t${5:pass}", {
        label: "tryfinally",
        detail: "try...except...finally",
        type: "keyword",
    }),
    snippetCompletion("with open('${1:file}', '${2:r}') as ${3:f}:\n\t${4}", {
        label: "with open",
        detail: "open file with context manager",
        type: "keyword",
    }),
    snippetCompletion("[${1:expr} for ${2:item} in ${3:iterable}]", {
        label: "listcomp",
        detail: "list comprehension",
        type: "keyword",
    }),
    snippetCompletion("{${1:key}: ${2:val} for ${3:item} in ${4:iterable}}", {
        label: "dictcomp",
        detail: "dict comprehension",
        type: "keyword",
    }),
    snippetCompletion("print(${1})", {
        label: "print",
        detail: "print to stdout",
        type: "function",
    }),
    snippetCompletion("import ${1:module}", {
        label: "import",
        detail: "import module",
        type: "keyword",
    }),
    snippetCompletion("from ${1:module} import ${2:name}", {
        label: "from import",
        detail: "from...import",
        type: "keyword",
    }),
    snippetCompletion("if __name__ == '__main__':\n\t${1:main()}", {
        label: "main",
        detail: "main guard",
        type: "keyword",
    }),
    snippetCompletion("lambda ${1:params}: ${2:expr}", {
        label: "lambda",
        detail: "lambda expression",
        type: "function",
    }),
]

// ─── Per-language completion source ──────────────────────────────────────────

function makeSnippetSource(snippets: Completion[]) {
    return (context: CompletionContext): CompletionResult | null => {
        const word = context.matchBefore(/\w*/)
        if (!word || (word.from === word.to && !context.explicit)) return null
        return {
            from: word.from,
            options: snippets,
            validFor: /^\w*$/,
        }
    }
}

// ─── Build extension per language ────────────────────────────────────────────

export function createAutocompleteExtension(language: string): Extension[] {
    const lang = language.toLowerCase()

    const baseExtensions: Extension[] = [
        autocompletion({
            activateOnTyping: true,
            selectOnOpen: false,  // don't auto-select, let user choose
            closeOnBlur: true,
            maxRenderedOptions: 10,
            defaultKeymap: true,
            icons: true,
        }),
        closeBrackets(),
        keymap.of([...completionKeymap, ...closeBracketsKeymap]),
    ]

    if (lang === "javascript" || lang === "js") {
        return [
            javascript({ jsx: false, typescript: false }),
            autocompletion({
                activateOnTyping: true,
                override: [makeSnippetSource(jsSnippets)],
                icons: true,
            }),
            closeBrackets(),
            keymap.of([...completionKeymap, ...closeBracketsKeymap]),
        ]
    }

    if (lang === "typescript" || lang === "ts") {
        return [
            javascript({ jsx: false, typescript: true }),
            autocompletion({
                activateOnTyping: true,
                override: [makeSnippetSource(jsSnippets)],
                icons: true,
            }),
            closeBrackets(),
            keymap.of([...completionKeymap, ...closeBracketsKeymap]),
        ]
    }

    if (lang === "jsx") {
        return [
            javascript({ jsx: true, typescript: false }),
            autocompletion({
                activateOnTyping: true,
                override: [makeSnippetSource(jsSnippets)],
                icons: true,
            }),
            closeBrackets(),
            keymap.of([...completionKeymap, ...closeBracketsKeymap]),
        ]
    }

    if (lang === "tsx") {
        return [
            javascript({ jsx: true, typescript: true }),
            autocompletion({
                activateOnTyping: true,
                override: [makeSnippetSource(jsSnippets)],
                icons: true,
            }),
            closeBrackets(),
            keymap.of([...completionKeymap, ...closeBracketsKeymap]),
        ]
    }

    if (lang === "python" || lang === "py") {
        return [
            python(),
            autocompletion({
                activateOnTyping: true,
                override: [makeSnippetSource(pySnippets)],
                icons: true,
            }),
            closeBrackets(),
            keymap.of([...completionKeymap, ...closeBracketsKeymap]),
        ]
    }

    if (lang === "html") {
        return [
            html({ selfClosingTags: true }),
            ...baseExtensions,
        ]
    }

    if (lang === "css" || lang === "scss" || lang === "sass" || lang === "less") {
        return [
            css(),
            ...baseExtensions,
        ]
    }

    // All other languages: generic word-based autocomplete + auto brackets
    return baseExtensions
}