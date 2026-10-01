import { useFileSystem } from "@/context/FileContext"
import {
    authenticateWithGitHubDevice,
    clearGitHubToken,
    getGitHubAuthConfiguration,
    getGitHubUser,
    getStoredGitHubToken,
    GitHubApiError,
    importGitHubRepository,
    parseGitHubRepositoryInput,
    pushGitHubRepository,
    storeGitHubToken,
} from "@/api/githubApi"
import {
    GitHubAuthConfiguration,
    GitHubDeviceCode,
    GitHubImportedRepository,
} from "@/types/github"
import { FormEvent, useEffect, useRef, useState } from "react"

function errorMessage(error: unknown): string {
    if (error instanceof GitHubApiError) return error.message
    if (error instanceof Error && error.message) return error.message
    return "GitHub request failed. Check your connection and try again."
}

/**
 * GitHub adapter for the collaborative file tree. Imports replace the virtual
 * root through FileContext.updateDirectory(), which emits the existing
 * DIRECTORY_UPDATED socket event so everyone in the room sees the repository.
 * Pushes read the current fileStructure, including edits from collaborators.
 */
function GitHubView() {
    const { fileStructure, updateDirectory } = useFileSystem()
    const [configuration, setConfiguration] =
        useState<GitHubAuthConfiguration | null>(null)
    const [configurationError, setConfigurationError] = useState("")
    const [tokenPresent, setTokenPresent] = useState(() => Boolean(getStoredGitHubToken()))
    const [githubLogin, setGithubLogin] = useState("")
    const [deviceCode, setDeviceCode] = useState<GitHubDeviceCode | null>(null)
    const [authLoading, setAuthLoading] = useState(false)
    const [repositoryInput, setRepositoryInput] = useState("")
    const [repository, setRepository] =
        useState<GitHubImportedRepository | null>(null)
    const [commitMessage, setCommitMessage] = useState("Update from Code Sync")
    const [busyAction, setBusyAction] = useState<"import" | "push" | null>(null)
    const [error, setError] = useState("")
    const [status, setStatus] = useState("")
    const authAbortController = useRef<AbortController | null>(null)

    useEffect(() => {
        let mounted = true
        getGitHubAuthConfiguration()
            .then((value) => {
                if (mounted) setConfiguration(value)
            })
            .catch((reason: unknown) => {
                if (!mounted) return
                setConfiguration({ configured: false, source: null })
                setConfigurationError(errorMessage(reason))
            })
        return () => {
            mounted = false
        }
    }, [])

    useEffect(() => {
        const token = getStoredGitHubToken()
        if (!token) return
        let mounted = true
        getGitHubUser(token)
            .then((user) => {
                if (mounted) setGithubLogin(user.login)
            })
            .catch((reason: unknown) => {
                if (reason instanceof GitHubApiError && reason.status === 401) {
                    clearGitHubToken()
                    if (mounted) {
                        setTokenPresent(false)
                        setGithubLogin("")
                    }
                }
            })
        return () => {
            mounted = false
        }
    }, [tokenPresent])

    useEffect(
        () => () => {
            authAbortController.current?.abort()
        },
        [],
    )

    const handleSignIn = async () => {
        setError("")
        setStatus("")
        setDeviceCode(null)
        if (!configuration?.configured) {
            setError(
                configurationError ||
                    "GitHub is not configured. Set VITE_GITHUB_CLIENT_ID in the frontend, or GITHUB_CLIENT_ID on the backend, then restart the app.",
            )
            return
        }

        const controller = new AbortController()
        authAbortController.current = controller
        setAuthLoading(true)
        try {
            const token = await authenticateWithGitHubDevice(
                setDeviceCode,
                controller.signal,
            )
            storeGitHubToken(token)
            setTokenPresent(true)
            setStatus("GitHub sign-in complete. Your token stays in this tab only.")
            const user = await getGitHubUser(token)
            setGithubLogin(user.login)
        } catch (reason: unknown) {
            if (!(reason instanceof DOMException && reason.name === "AbortError")) {
                setError(errorMessage(reason))
            }
        } finally {
            authAbortController.current = null
            setAuthLoading(false)
            setDeviceCode(null)
        }
    }

    const handleSignOut = () => {
        authAbortController.current?.abort()
        clearGitHubToken()
        setTokenPresent(false)
        setGithubLogin("")
        setDeviceCode(null)
        setRepository(null)
        setError("")
        setStatus("GitHub token cleared from this browser tab.")
    }

    const handleImport = async (event: FormEvent) => {
        event.preventDefault()
        setError("")
        setStatus("")
        const token = getStoredGitHubToken()
        if (!token) {
            setError("Sign in to GitHub before importing a repository.")
            setTokenPresent(false)
            return
        }
        const input = parseGitHubRepositoryInput(repositoryInput)
        if (!input) {
            setError("Enter a GitHub URL or owner/repository, for example octocat/Hello-World.")
            return
        }

        setBusyAction("import")
        try {
            const result = await importGitHubRepository(token, input)
            // This is deliberately the same FileContext adapter used by local
            // folder/ZIP imports. Passing an empty parent targets the virtual
            // root and broadcasts the complete tree over the existing socket.
            updateDirectory("", result.fileStructure)
            setRepository(result.repository)
            const skipped = result.skippedFiles.length
            setStatus(
                `Imported ${input.owner}/${input.name} (${Object.keys(result.repository.files).length} files) on ${result.repository.branch}.${
                    skipped ? ` Skipped ${skipped} unsupported or oversized file${skipped === 1 ? "" : "s"}.` : ""
                }`,
            )
        } catch (reason: unknown) {
            if (reason instanceof GitHubApiError && reason.status === 401) {
                clearGitHubToken()
                setTokenPresent(false)
                setGithubLogin("")
            }
            setError(errorMessage(reason))
        } finally {
            setBusyAction(null)
        }
    }

    const handlePush = async () => {
        setError("")
        setStatus("")
        const token = getStoredGitHubToken()
        if (!token) {
            setError("Sign in to GitHub before pushing changes.")
            setTokenPresent(false)
            return
        }
        if (!repository) {
            setError("Import a repository before pushing changes.")
            return
        }
        setBusyAction("push")
        try {
            const result = await pushGitHubRepository(
                token,
                repository,
                fileStructure,
                commitMessage,
            )
            setRepository(result.repository)
            setStatus(
                result.changedFiles === 0 && result.deletedFiles === 0
                    ? "No file changes to push."
                    : `Pushed commit ${result.commitSha.slice(0, 7)} (${result.changedFiles} changed, ${result.deletedFiles} deleted).`,
            )
        } catch (reason: unknown) {
            if (reason instanceof GitHubApiError && reason.status === 401) {
                clearGitHubToken()
                setTokenPresent(false)
                setGithubLogin("")
            }
            setError(errorMessage(reason))
        } finally {
            setBusyAction(null)
        }
    }

    const authUnavailable = configuration !== null && !configuration.configured

    return (
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-4 text-sm">
            <div>
                <span className="workspace-eyebrow">GITHUB</span>
                <h2 className="mt-1 text-lg font-semibold text-white">Repository sync</h2>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                    Import a repository into this room, collaborate, then push one commit from the current tree.
                </p>
            </div>

            <section className="rounded-lg border border-slate-700/80 bg-slate-900/60 p-3">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h3 className="font-medium text-slate-100">GitHub access</h3>
                        <p className="mt-1 text-xs text-slate-400">
                            {tokenPresent
                                ? githubLogin
                                    ? `Signed in as ${githubLogin}`
                                    : "Signed in for this tab"
                                : "No GitHub token in this tab"}
                        </p>
                    </div>
                    {tokenPresent ? (
                        <button
                            type="button"
                            className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 transition hover:border-red-400 hover:text-red-300"
                            onClick={handleSignOut}
                        >
                            Clear token
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="rounded bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={handleSignIn}
                            disabled={authLoading || configuration === null || authUnavailable}
                        >
                            {authLoading ? "Waiting…" : "Sign in"}
                        </button>
                    )}
                </div>

                {configuration === null && (
                    <p className="mt-3 text-xs text-slate-400">Checking GitHub OAuth configuration…</p>
                )}
                {authUnavailable && (
                    <p className="mt-3 rounded bg-amber-500/10 p-2 text-xs leading-5 text-amber-200">
                        OAuth is not configured. Set <code>VITE_GITHUB_CLIENT_ID</code> in the frontend environment, or <code>GITHUB_CLIENT_ID</code> on the backend, then restart the relevant service. No client secret is placed in the browser.
                    </p>
                )}
                {deviceCode && (
                    <div className="mt-3 rounded bg-slate-800 p-3 text-xs text-slate-300">
                        <p>Open GitHub and enter this one-time code:</p>
                        <p className="my-2 text-center text-xl font-semibold tracking-[0.25em] text-white">
                            {deviceCode.user_code}
                        </p>
                        <a
                            className="text-indigo-300 underline hover:text-indigo-200"
                            href={deviceCode.verification_uri_complete || deviceCode.verification_uri}
                            target="_blank"
                            rel="noreferrer"
                        >
                            Continue at github.com
                        </a>
                        <span className="ml-2 text-slate-500">Waiting for approval…</span>
                    </div>
                )}
            </section>

            <form className="flex flex-col gap-2" onSubmit={handleImport}>
                <label className="text-xs font-medium text-slate-300" htmlFor="github-repository">
                    Repository URL or owner/name
                </label>
                <input
                    id="github-repository"
                    className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-400"
                    value={repositoryInput}
                    onChange={(event) => setRepositoryInput(event.target.value)}
                    placeholder="https://github.com/owner/repository"
                    autoComplete="off"
                />
                <button
                    type="submit"
                    className="rounded bg-slate-700 px-3 py-2 text-xs font-medium text-slate-100 transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={busyAction !== null || !tokenPresent}
                >
                    {busyAction === "import" ? "Importing…" : "Import repository"}
                </button>
            </form>

            {repository && (
                <section className="rounded-lg border border-slate-700/80 bg-slate-900/60 p-3">
                    <p className="font-medium text-slate-100">
                        {repository.owner}/{repository.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                        Branch <span className="text-slate-200">{repository.branch}</span> · {Object.keys(repository.files).length} tracked files
                    </p>
                    <label className="mt-3 block text-xs font-medium text-slate-300" htmlFor="github-commit-message">
                        Commit message
                    </label>
                    <input
                        id="github-commit-message"
                        className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-400"
                        value={commitMessage}
                        onChange={(event) => setCommitMessage(event.target.value)}
                        maxLength={256}
                        placeholder="Describe your changes"
                    />
                    <button
                        type="button"
                        className="mt-2 w-full rounded bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={handlePush}
                        disabled={busyAction !== null || !tokenPresent}
                    >
                        {busyAction === "push" ? "Pushing…" : "Commit and push"}
                    </button>
                    <p className="mt-2 text-[11px] leading-4 text-slate-500">
                        Changes from this room are assembled into one Git commit. A concurrent remote update is rejected safely; import again before retrying.
                    </p>
                </section>
            )}

            {error && (
                <p className="rounded border border-red-500/30 bg-red-500/10 p-2 text-xs leading-5 text-red-200" role="alert">
                    {error}
                </p>
            )}
            {status && (
                <p className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs leading-5 text-emerald-200" role="status">
                    {status}
                </p>
            )}
        </div>
    )
}

export default GitHubView
