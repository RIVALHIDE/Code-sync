/**
 * Maps file extensions to CodeMirror language names when lang-map gives the
 * wrong result or returns nothing.  Keys are lowercase extensions (no dot).
 */
const customMapping: { [key: string]: string } = {
    // Already present
    php: "php",
    cs: "csharp",

    // Web
    ts: "typescript",
    tsx: "tsx",
    jsx: "jsx",
    html: "html",
    htm: "html",
    css: "css",
    scss: "sass",
    sass: "sass",
    less: "less",
    vue: "vue",
    svelte: "svelte",

    // Systems / compiled
    rs: "rust",
    go: "go",
    kt: "kotlin",
    kts: "kotlin",
    swift: "swift",
    dart: "dart",
    cpp: "cpp",
    cxx: "cpp",
    cc: "cpp",
    c: "c",
    h: "c",
    hpp: "cpp",
    m: "objectivec",

    // JVM
    java: "java",
    scala: "scala",
    groovy: "groovy",
    clj: "clojure",

    // Scripting
    py: "python",
    pyw: "python",
    rb: "ruby",
    lua: "lua",
    pl: "perl",
    r: "r",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    fish: "shell",
    ps1: "powershell",
    bat: "shell",
    cmd: "shell",

    // Data / config
    json: "json",
    jsonc: "json",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    xml: "xml",
    svg: "xml",
    sql: "sql",
    graphql: "graphql",
    gql: "graphql",
    proto: "protobuf",

    // Docs / markup
    md: "markdown",
    mdx: "markdown",
    tex: "stex",
    rst: "rst",

    // Misc
    dockerfile: "dockerfile",
    tf: "hcl",
    hcl: "hcl",
    ex: "elixir",
    exs: "elixir",
    erl: "erlang",
    hs: "haskell",
    elm: "elm",
    ml: "ocaml",
    mli: "ocaml",
    nim: "nim",
    zig: "zig",
}

export default customMapping
