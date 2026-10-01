import { Language } from "@/types/run"

export interface LocalExecutionResult {
    stdout: string
    stderr: string
}

interface PythonRuntimeConfig {
    loaderUrl: string
    indexUrl?: string
}

export const LOCAL_JAVASCRIPT_LANGUAGE: Language = {
    language: "JavaScript",
    version: "browser worker",
    aliases: ["javascript", "js"],
}

export const LOCAL_PYTHON_LANGUAGE: Language = {
    language: "Python",
    version: "configured browser runtime",
    aliases: ["python", "py"],
}

export const LOCAL_EXECUTION_TIMEOUT_MS = 3000

const PYTHON_RUNTIME_MESSAGE =
    "Python offline execution is disabled. Configure VITE_PYTHON_RUNTIME_URL with a Pyodide loader URL (and optionally VITE_PYTHON_RUNTIME_INDEX_URL) to enable it. The loader and Wasm assets must be reachable or cached in the browser."

/**
 * A Worker gives JavaScript its own event loop and lets the caller terminate
 * runaway code. It is intentionally not advertised as a security boundary for
 * hostile code: browser permissions still depend on the origin's CSP/browser.
 */
const JAVASCRIPT_WORKER_SOURCE = String.raw`
function stringify(value) {
    if (typeof value === "string") return value;
    if (typeof value === "undefined") return "undefined";
    if (value instanceof Error) return value.stack || (value.name + ": " + value.message);
    try {
        var json = JSON.stringify(value);
        return typeof json === "undefined" ? String(value) : json;
    } catch (_) {
        return String(value);
    }
}

self.onmessage = function (event) {
    var request = event.data || {};
    var stdout = "";
    var stderr = "";
    var finished = false;
    var originalConsole = globalThis.console;
    var originalGlobals = {};

    function write(target, values, newline) {
        var text = values.map(stringify).join(" ");
        if (target === "stdout") stdout += text + (newline ? "\n" : "");
        else stderr += text + (newline ? "\n" : "");
    }

    function finish() {
        if (finished) return;
        finished = true;
        globalThis.console = originalConsole;
        Object.keys(originalGlobals).forEach(function (name) {
            try { globalThis[name] = originalGlobals[name]; } catch (_) { /* read-only global */ }
        });
        self.postMessage({ type: "result", stdout: stdout, stderr: stderr });
    }

    function fail(error) {
        write("stderr", [error], true);
        finish();
    }

    ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts"].forEach(function (name) {
        try {
            originalGlobals[name] = globalThis[name];
            globalThis[name] = function () {
                throw new Error(name + " is disabled in the local JavaScript runner");
            };
        } catch (_) { /* read-only global */ }
    });

    var localConsole = {
        log: function () { write("stdout", Array.prototype.slice.call(arguments), true); },
        info: function () { write("stdout", Array.prototype.slice.call(arguments), true); },
        debug: function () { write("stdout", Array.prototype.slice.call(arguments), true); },
        warn: function () { write("stderr", Array.prototype.slice.call(arguments), true); },
        error: function () { write("stderr", Array.prototype.slice.call(arguments), true); },
    };
    globalThis.console = localConsole;

    self.onerror = function (message, _source, _line, _column, error) {
        fail(error || message);
        return true;
    };
    self.onunhandledrejection = function (event) {
        fail(event && event.reason ? event.reason : "Unhandled promise rejection");
    };

    var input = typeof request.input === "string" ? request.input : String(request.input || "");
    var processShim = {
        env: {},
        argv: [],
        stdin: { read: function () { return input; } },
        stdout: { write: function (value) { write("stdout", [value], false); } },
        stderr: { write: function (value) { write("stderr", [value], false); } },
        exit: function (code) { throw new Error("process.exit(" + String(code || 0) + ")"); },
    };

    try {
        var execute = new Function(
            "input",
            "readInput",
            "console",
            "process",
            "\"use strict\"; return (async function () {\n" + String(request.code || "") + "\n}).call(this);",
        );
        Promise.resolve(execute(input, function () { return input; }, localConsole, processShim))
            .then(function () { setTimeout(finish, 0); })
            .catch(fail);
    } catch (error) {
        fail(error);
    }
};
`

const PYTHON_WORKER_SOURCE = String.raw`
function stringify(value) {
    if (typeof value === "string") return value;
    if (value instanceof Error) return value.stack || (value.name + ": " + value.message);
    try { return String(value); } catch (_) { return "Python runtime error"; }
}

self.onmessage = async function (event) {
    var request = event.data || {};
    var stdout = "";
    var stderr = "";
    var finished = false;

    function finish() {
        if (finished) return;
        finished = true;
        self.postMessage({ type: "result", stdout: stdout, stderr: stderr });
    }

    if (!request.runtimeUrl) {
        stderr = "Python offline execution is not configured. Set VITE_PYTHON_RUNTIME_URL to a Pyodide loader URL.";
        finish();
        return;
    }

    try {
        importScripts(request.runtimeUrl);
        if (typeof self.loadPyodide !== "function") {
            throw new Error("The configured Python runtime did not expose loadPyodide");
        }
        var runtimeUrl = String(request.runtimeUrl);
        var inferredIndex = runtimeUrl.slice(0, runtimeUrl.lastIndexOf("/") + 1);
        var pyodide = await self.loadPyodide({ indexURL: request.indexUrl || inferredIndex });
        if (typeof pyodide.setStdout === "function") {
            pyodide.setStdout({ batched: function (value) { stdout += String(value); } });
        }
        if (typeof pyodide.setStderr === "function") {
            pyodide.setStderr({ batched: function (value) { stderr += String(value); } });
        }
        if (typeof pyodide.setStdin === "function") {
            var lines = String(request.input || "").split(/\r?\n/);
            pyodide.setStdin({ stdin: function () {
                return lines.length > 0 ? lines.shift() : null;
            } });
        }
        await pyodide.runPythonAsync(String(request.code || ""));
        finish();
    } catch (error) {
        stderr += stringify(error);
        finish();
    }
};
`

function getPythonRuntimeConfig(): PythonRuntimeConfig | null {
    const loaderUrl = (
        import.meta.env.VITE_PYTHON_RUNTIME_URL ||
        import.meta.env.VITE_PYODIDE_URL ||
        ""
    ).trim()
    if (!loaderUrl) return null

    const indexUrl = (
        import.meta.env.VITE_PYTHON_RUNTIME_INDEX_URL ||
        import.meta.env.VITE_PYODIDE_INDEX_URL ||
        ""
    ).trim()
    return indexUrl ? { loaderUrl, indexUrl } : { loaderUrl }
}

export function getPythonRuntimeMessage(): string {
    return PYTHON_RUNTIME_MESSAGE
}

export function isJavaScriptLanguage(language: Language): boolean {
    const normalized = language.language.trim().toLowerCase()
    return (
        normalized === "javascript" ||
        normalized === "node.js" ||
        normalized === "nodejs" ||
        normalized === "node-js" ||
        language.aliases.some((alias) => alias.toLowerCase() === "js")
    )
}

export function isPythonLanguage(language: Language): boolean {
    const normalized = language.language.trim().toLowerCase()
    return (
        normalized === "python" ||
        normalized === "python3" ||
        language.aliases.some((alias) => {
            const normalizedAlias = alias.toLowerCase()
            return normalizedAlias === "py" || normalizedAlias === "python"
        })
    )
}

export function isPythonRuntimeConfigured(): boolean {
    return getPythonRuntimeConfig() !== null
}

class LocalExecutionError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "LocalExecutionError"
    }
}

function executeWorker(
    source: string,
    request: Record<string, string>,
    timeoutMs: number,
): Promise<LocalExecutionResult> {
    return new Promise((resolve, reject) => {
        if (typeof Worker === "undefined" || typeof Blob === "undefined") {
            reject(new LocalExecutionError("This browser does not support local Worker execution."))
            return
        }

        const objectUrl = URL.createObjectURL(
            new Blob([source], { type: "text/javascript" }),
        )
        let worker: Worker | null = null
        let settled = false
        const timeoutId = window.setTimeout(() => {
            if (settled) return
            settled = true
            worker?.terminate()
            URL.revokeObjectURL(objectUrl)
            reject(
                new LocalExecutionError(
                    `Local execution timed out after ${timeoutMs / 1000} seconds.`,
                ),
            )
        }, timeoutMs)

        const finish = (callback: () => void) => {
            if (settled) return
            settled = true
            window.clearTimeout(timeoutId)
            worker?.terminate()
            URL.revokeObjectURL(objectUrl)
            callback()
        }

        try {
            worker = new Worker(objectUrl)
            worker.onmessage = (event: MessageEvent<LocalExecutionResult & { type?: string }>) => {
                if (event.data?.type !== "result") {
                    finish(() => reject(new LocalExecutionError("Local executor returned an invalid result.")))
                    return
                }
                finish(() =>
                    resolve({
                        stdout: event.data.stdout || "",
                        stderr: event.data.stderr || "",
                    }),
                )
            }
            worker.onerror = (event) => {
                finish(() =>
                    reject(
                        new LocalExecutionError(
                            event.message || "The local executor worker failed.",
                        ),
                    ),
                )
            }
            worker.postMessage(request)
        } catch (error) {
            finish(() =>
                reject(
                    error instanceof Error
                        ? error
                        : new LocalExecutionError("Unable to start the local executor worker."),
                ),
            )
        }
    })
}

export function runJavaScriptLocally(
    code: string,
    input: string,
    timeoutMs = LOCAL_EXECUTION_TIMEOUT_MS,
): Promise<LocalExecutionResult> {
    return executeWorker(JAVASCRIPT_WORKER_SOURCE, { code, input }, timeoutMs)
}

export function runPythonLocally(
    code: string,
    input: string,
    timeoutMs = LOCAL_EXECUTION_TIMEOUT_MS,
): Promise<LocalExecutionResult> {
    const config = getPythonRuntimeConfig()
    if (!config) {
        return Promise.reject(new LocalExecutionError(PYTHON_RUNTIME_MESSAGE))
    }
    return executeWorker(
        PYTHON_WORKER_SOURCE,
        {
            code,
            input,
            runtimeUrl: config.loaderUrl,
            indexUrl: config.indexUrl || "",
        },
        timeoutMs,
    )
}
