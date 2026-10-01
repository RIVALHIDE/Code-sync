import { FileSystemItem } from "@/types/file"
import {
    GitHubAuthConfiguration,
    GitHubDeviceCode,
    GitHubImportResult,
    GitHubImportedRepository,
    GitHubPushOptions,
    GitHubPushPreview,
    GitHubPushResult,
    GitHubRemoteFile,
    GitHubRepositoryInput,
} from "@/types/github"
import { v4 as uuidV4 } from "uuid"

const TOKEN_STORAGE_KEY = "codesync.github.access_token"
const MAX_FILE_BYTES = 2 * 1024 * 1024
const MAX_IMPORTED_FILES = 2000
const MAX_IMPORTED_BYTES = 20 * 1024 * 1024
const MAX_TREE_ENTRIES = 10_000
const MAX_PATH_DEPTH = 32
const MAX_COMMIT_MESSAGE_LENGTH = 256
const GITHUB_API_PATH = "/api/github/request"

const backendUrl = (
    typeof import.meta.env.VITE_BACKEND_URL === "string"
        ? import.meta.env.VITE_BACKEND_URL
        : ""
).replace(/\/$/, "")

export class GitHubApiError extends Error {
    readonly status?: number
    readonly code?: string
    readonly preview?: GitHubPushPreview

    constructor(
        message: string,
        status?: number,
        code?: string,
        preview?: GitHubPushPreview,
    ) {
        super(message)
        this.name = "GitHubApiError"
        this.status = status
        this.code = code
        this.preview = preview
    }
}

interface GitHubResponseError {
    message?: string
    error?: string
    error_description?: string
}

interface GitHubRepositoryResponse {
    default_branch: string
}

interface GitHubRefResponse {
    object?: { sha?: string; type?: string }
}

interface GitHubCommitResponse {
    sha: string
    tree?: { sha?: string }
}

interface GitHubTreeEntry {
    path?: string
    mode?: string
    type?: "blob" | "tree" | "commit" | string
    sha?: string
    size?: number
}

interface GitHubTreeResponse {
    sha: string
    truncated?: boolean
    tree?: GitHubTreeEntry[]
}

interface GitHubBlobResponse {
    sha: string
    encoding?: string
    content?: string
    size?: number
}

interface GitHubCreatedCommitResponse {
    sha: string
    tree?: { sha?: string }
}

interface GitHubOAuthConfigurationResponse {
    configured?: boolean
    source?: "backend"
}

interface GitHubOAuthTokenResponse {
    access_token?: string
    error?: string
    error_description?: string
}

export function getStoredGitHubToken(): string | null {
    try {
        const token = sessionStorage.getItem(TOKEN_STORAGE_KEY)
        return token && token.trim() ? token : null
    } catch {
        return null
    }
}

export function storeGitHubToken(token: string): void {
    if (!/^[a-zA-Z0-9_.-]{1,512}$/.test(token)) {
        throw new GitHubApiError("GitHub returned an invalid access token")
    }
    try {
        sessionStorage.setItem(TOKEN_STORAGE_KEY, token)
    } catch {
        throw new GitHubApiError(
            "This browser blocked session storage; GitHub sign-in cannot continue.",
        )
    }
}

export function clearGitHubToken(): void {
    try {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY)
    } catch {
        // Clearing an already unavailable storage area is safe to ignore.
    }
}

function backendEndpoint(path: string): string {
    if (!backendUrl) {
        throw new GitHubApiError(
            "Set VITE_BACKEND_URL to the Code Sync backend before signing in.",
        )
    }
    return `${backendUrl}${path}`
}

async function readJson(response: Response): Promise<unknown> {
    return response.json().catch(() => ({}))
}

function responseError(
    payload: unknown,
    fallback: string,
    status?: number,
): GitHubApiError {
    const body = (
        payload !== null && typeof payload === "object" && !Array.isArray(payload)
            ? payload
            : {}
    ) as GitHubResponseError
    const code = typeof body.error === "string" ? body.error : undefined
    const message =
        typeof body.error_description === "string"
            ? body.error_description
            : typeof body.message === "string"
              ? body.message
              : fallback
    return new GitHubApiError(message, status, code)
}

function requestMethod(init: RequestInit): "GET" | "POST" | "PATCH" {
    const method = (init.method ?? "GET").toUpperCase()
    if (method !== "GET" && method !== "POST" && method !== "PATCH") {
        throw new GitHubApiError("Unsupported GitHub request method")
    }
    return method
}

function requestBody(init: RequestInit): unknown {
    if (init.body === undefined || init.body === null) return undefined
    try {
        return JSON.parse(String(init.body)) as unknown
    } catch {
        throw new GitHubApiError("GitHub request body must be JSON")
    }
}

/** All GitHub API calls go through the backend to avoid browser CORS and keep the flow auditable. */
async function requestGitHub<T>(
    path: string,
    token: string,
    init: RequestInit = {},
): Promise<T> {
    if (!token) throw new GitHubApiError("Sign in to GitHub first", 401)
    const response = await fetch(backendEndpoint(GITHUB_API_PATH), {
        method: "POST",
        signal: init.signal,
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            path,
            method: requestMethod(init),
            body: requestBody(init),
        }),
    })
    const payload = await readJson(response)
    if (!response.ok) {
        throw responseError(payload, "GitHub request failed", response.status)
    }
    return payload as T
}

async function requestBackend<T>(
    path: string,
    init: RequestInit = {},
): Promise<T> {
    const response = await fetch(backendEndpoint(path), {
        ...init,
        headers: {
            Accept: "application/json",
            ...(init.body ? { "Content-Type": "application/json" } : {}),
            ...(init.headers ?? {}),
        },
    })
    const payload = await readJson(response)
    if (!response.ok) {
        throw responseError(payload, "GitHub OAuth service failed", response.status)
    }
    return payload as T
}

export async function getGitHubAuthConfiguration(): Promise<GitHubAuthConfiguration> {
    try {
        const configuration = await requestBackend<GitHubOAuthConfigurationResponse>(
            "/api/github/config",
        )
        return configuration.configured
            ? { configured: true, source: "backend" }
            : { configured: false, source: null }
    } catch {
        return { configured: false, source: null }
    }
}

async function requestDeviceCode(signal?: AbortSignal): Promise<GitHubDeviceCode> {
    const response = await fetch(backendEndpoint("/api/github/device/code"), {
        method: "POST",
        signal,
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ scope: "repo" }),
    })
    const payload = await readJson(response)
    if (!response.ok || typeof (payload as { device_code?: unknown }).device_code !== "string") {
        throw responseError(payload, "Unable to start GitHub sign-in", response.status)
    }
    return payload as GitHubDeviceCode
}

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException("The GitHub sign-in was cancelled", "AbortError"))
            return
        }
        const timeout = globalThis.setTimeout(resolve, milliseconds)
        signal?.addEventListener(
            "abort",
            () => {
                globalThis.clearTimeout(timeout)
                reject(new DOMException("The GitHub sign-in was cancelled", "AbortError"))
            },
            { once: true },
        )
    })
}

/** Start GitHub's device flow; the token is returned for sessionStorage only. */
export async function authenticateWithGitHubDevice(
    onDeviceCode: (deviceCode: GitHubDeviceCode) => void,
    signal?: AbortSignal,
): Promise<string> {
    const device = await requestDeviceCode(signal)
    onDeviceCode(device)

    const expiresAt = Date.now() + device.expires_in * 1000
    let intervalSeconds = Math.max(device.interval ?? 5, 5)

    while (Date.now() < expiresAt) {
        await wait(intervalSeconds * 1000, signal)
        const response = await fetch(backendEndpoint("/api/github/device/token"), {
            method: "POST",
            signal,
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                device_code: device.device_code,
                grant_type: "urn:ietf:params:oauth:grant-type:device_code",
            }),
        })
        const payload = (await readJson(response)) as GitHubOAuthTokenResponse

        if (typeof payload.access_token === "string" && payload.access_token) {
            return payload.access_token
        }
        if (payload.error === "authorization_pending") continue
        if (payload.error === "slow_down") {
            intervalSeconds += 5
            continue
        }
        if (payload.error === "expired_token") {
            throw new GitHubApiError("The GitHub sign-in code expired. Try again.", 400)
        }
        if (payload.error === "access_denied") {
            throw new GitHubApiError("GitHub sign-in was denied.", 400)
        }
        if (!response.ok || payload.error) {
            throw responseError(payload, "GitHub sign-in failed", response.status)
        }
    }

    throw new GitHubApiError("The GitHub sign-in code expired. Try again.", 408)
}

export function parseGitHubRepositoryInput(
    input: string,
): GitHubRepositoryInput | null {
    const trimmed = input.trim().replace(/\/+$/, "")
    if (!trimmed) return null

    let path = trimmed
    try {
        if (/^https?:\/\//i.test(trimmed)) {
            const url = new URL(trimmed)
            if (
                url.hostname.toLowerCase() !== "github.com" &&
                url.hostname.toLowerCase() !== "www.github.com"
            ) {
                return null
            }
            if (url.search || url.hash) return null
            path = url.pathname
        }
    } catch {
        return null
    }

    path = path
        .replace(/^https?:\/\/github\.com\//i, "")
        .replace(/^\/+/, "")
        .replace(/\.git\/?$/, "")
        .replace(/\/+$/, "")
    const parts = path.split("/")
    if (parts.length !== 2) return null
    const [owner, name] = parts
    const validSegment = (value: string) =>
        value.length > 0 &&
        value.length <= 100 &&
        value !== "." &&
        value !== ".." &&
        !value.includes("\\") &&
        /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(value)
    if (!validSegment(owner) || !validSegment(name)) return null
    return { owner, name }
}

function encodePath(path: string): string {
    return path.split("/").map((part) => encodeURIComponent(part)).join("/")
}

function encodeBase64(value: string): string {
    const bytes = new TextEncoder().encode(value)
    let binary = ""
    const chunkSize = 0x8000
    for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
    }
    return btoa(binary)
}

function decodeBase64Bytes(value: string): Uint8Array {
    const binary = atob(value.replace(/\s/g, ""))
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index)
    }
    return bytes
}

function decodeUtf8(bytes: Uint8Array): string | null {
    try {
        // Fatal decoding avoids silently turning arbitrary binary into text.
        const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
        if (bytes.includes(0)) return null
        return content
    } catch {
        return null
    }
}

function isSafeRepositoryPath(path: string): boolean {
    if (
        !path ||
        path.startsWith("/") ||
        path.includes("\\") ||
        /[\u0000-\u001f\u007f]/.test(path)
    ) {
        return false
    }
    const parts = path.split("/")
    return (
        parts.length <= MAX_PATH_DEPTH &&
        parts.every((part) => part.length > 0 && part !== "." && part !== "..")
    )
}

function createFileTree(files: Record<string, GitHubRemoteFile>): FileSystemItem[] {
    const root: FileSystemItem[] = []
    const directories = new Map<string, FileSystemItem>()

    const ensureDirectory = (parts: string[]): FileSystemItem => {
        const key = parts.join("/")
        const existing = directories.get(key)
        if (existing) return existing

        const directory: FileSystemItem = {
            id: uuidV4(),
            name: parts[parts.length - 1],
            type: "directory",
            children: [],
            isOpen: false,
            isDirty: false,
        }
        directories.set(key, directory)
        if (parts.length === 1) root.push(directory)
        else ensureDirectory(parts.slice(0, -1)).children!.push(directory)
        return directory
    }

    for (const path of Object.keys(files).sort()) {
        const parts = path.split("/")
        const name = parts.pop()
        if (!name) continue
        const parent = parts.length ? ensureDirectory(parts) : null
        const file: FileSystemItem = {
            id: uuidV4(),
            name,
            type: "file",
            content: files[path].content,
            isDirty: false,
        }
        if (parent) parent.children!.push(file)
        else root.push(file)
    }
    return root
}

function treePathOrThrow(path: unknown): string {
    if (typeof path !== "string" || !isSafeRepositoryPath(path)) {
        throw new GitHubApiError("GitHub returned an unsafe or too-deep repository path")
    }
    return path
}

async function loadRepositoryTree(
    token: string,
    owner: string,
    name: string,
    treeSha: string,
    signal?: AbortSignal,
): Promise<{ files: Record<string, GitHubRemoteFile>; skippedFiles: string[] }> {
    const repositoryPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`
    const tree = await requestGitHub<GitHubTreeResponse>(
        `${repositoryPath}/git/trees/${encodeURIComponent(treeSha)}?recursive=1`,
        token,
        { signal },
    )
    if (tree.truncated) {
        throw new GitHubApiError(
            "This repository tree is too large for a safe import; no files were changed.",
            413,
            "TREE_TRUNCATED",
        )
    }
    if (!Array.isArray(tree.tree) || tree.tree.length > MAX_TREE_ENTRIES) {
        throw new GitHubApiError(
            "This repository tree is too large for a safe import; no files were changed.",
            413,
            "TREE_TOO_LARGE",
        )
    }

    const files: Record<string, GitHubRemoteFile> = {}
    const skippedFiles: string[] = []
    let totalBytes = 0

    for (const entry of tree.tree) {
        const path = treePathOrThrow(entry.path)
        if (entry.type === "tree") continue
        // 120000 is a symbolic link; 160000/commit is a git submodule. The
        // text-only workspace cannot represent either without changing it.
        if (entry.type === "commit" || entry.mode === "120000" || entry.mode === "160000") {
            skippedFiles.push(path)
            continue
        }
        if (entry.type !== "blob" || !entry.sha) {
            skippedFiles.push(path)
            continue
        }
        const size = typeof entry.size === "number" ? entry.size : 0
        if (size > MAX_FILE_BYTES || totalBytes + size > MAX_IMPORTED_BYTES) {
            skippedFiles.push(path)
            continue
        }
        if (Object.keys(files).length >= MAX_IMPORTED_FILES) {
            skippedFiles.push(path)
            continue
        }

        const blob = await requestGitHub<GitHubBlobResponse>(
            `${repositoryPath}/git/blobs/${encodeURIComponent(entry.sha)}`,
            token,
            { signal },
        )
        if (blob.encoding !== "base64" || typeof blob.content !== "string") {
            skippedFiles.push(path)
            continue
        }
        const bytes = decodeBase64Bytes(blob.content)
        const content = decodeUtf8(bytes)
        if (content === null) {
            skippedFiles.push(path)
            continue
        }
        if (bytes.byteLength > MAX_FILE_BYTES || totalBytes + bytes.byteLength > MAX_IMPORTED_BYTES) {
            skippedFiles.push(path)
            continue
        }
        totalBytes += bytes.byteLength
        files[path] = {
            sha: entry.sha,
            content,
            mode: entry.mode,
        }
    }

    return { files, skippedFiles }
}

export async function importGitHubRepository(
    token: string,
    input: GitHubRepositoryInput,
    signal?: AbortSignal,
): Promise<GitHubImportResult> {
    const repositoryPath = `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.name)}`
    const repository = await requestGitHub<GitHubRepositoryResponse>(
        repositoryPath,
        token,
        { signal },
    )
    if (!repository.default_branch) {
        throw new GitHubApiError("GitHub did not return a default branch")
    }

    const branchPath = `${repositoryPath}/git/ref/heads/${encodePath(repository.default_branch)}`
    const ref = await requestGitHub<GitHubRefResponse>(branchPath, token, { signal })
    const headCommitSha = ref.object?.sha
    if (!headCommitSha) throw new GitHubApiError("GitHub did not return the branch head")

    const commit = await requestGitHub<GitHubCommitResponse>(
        `${repositoryPath}/git/commits/${encodeURIComponent(headCommitSha)}`,
        token,
        { signal },
    )
    const baseTreeSha = commit.tree?.sha
    if (!baseTreeSha) throw new GitHubApiError("GitHub did not return the repository tree")

    // The recursive Git Trees endpoint is tied to the captured commit. Unlike
    // /contents recursion it cannot silently mix files from a moving branch.
    const loaded = await loadRepositoryTree(
        token,
        input.owner,
        input.name,
        baseTreeSha,
        signal,
    )
    return {
        repository: {
            owner: input.owner,
            name: input.name,
            branch: repository.default_branch,
            headCommitSha,
            baseTreeSha,
            files: loaded.files,
        },
        fileStructure: createFileTree(loaded.files),
        skippedFiles: loaded.skippedFiles,
    }
}

function pathIsSafeForWorkspace(path: string): boolean {
    return isSafeRepositoryPath(path) && !path.endsWith("/")
}

function flattenFiles(
    node: FileSystemItem,
    parentPath = "",
    result: Record<string, string> = {},
): Record<string, string> {
    for (const child of node.children ?? []) {
        const path = parentPath ? `${parentPath}/${child.name}` : child.name
        if (!pathIsSafeForWorkspace(path)) {
            throw new GitHubApiError(`Invalid repository path: ${path}`)
        }
        if (child.type === "file") result[path] = child.content ?? ""
        else flattenFiles(child, path, result)
    }
    return result
}

function findFilePath(
    node: FileSystemItem,
    targetId: string,
    parentPath = "",
): string | null {
    for (const child of node.children ?? []) {
        const path = parentPath ? `${parentPath}/${child.name}` : child.name
        if (child.id === targetId && child.type === "file") return path
        if (child.type === "directory") {
            const found = findFilePath(child, targetId, path)
            if (found) return found
        }
    }
    return null
}

function currentFiles(
    fileStructure: FileSystemItem,
    activeFile?: FileSystemItem | null,
): Record<string, string> {
    const files = flattenFiles(fileStructure)
    // CodeMirror can hold the newest edit in activeFile for one render before
    // the canonical tree receives it. Overlay it at push time.
    if (activeFile?.type === "file") {
        const activePath = findFilePath(fileStructure, activeFile.id)
        if (activePath) files[activePath] = activeFile.content ?? ""
    }
    return files
}

const SENSITIVE_PATH_PATTERNS = [
    /(^|\/)\.env(?:\.|$)/i,
    /(^|\/)(?:credentials?|secrets?|private|passwords?)(?:\.|\/|$)/i,
    /\.(?:pem|key|p12|pfx|jks)$/i,
    /(^|\/)(?:id_rsa|token|access[_-]?key)(?:\.|$)/i,
]

export function isSensitiveGitHubPath(path: string): boolean {
    return SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(path))
}

export function createGitHubPushPreview(
    repository: GitHubImportedRepository,
    fileStructure: FileSystemItem,
    activeFile?: FileSystemItem | null,
): GitHubPushPreview {
    const current = currentFiles(fileStructure, activeFile)
    const addedPaths = Object.keys(current)
        .filter((path) => !(path in repository.files))
        .sort()
    const modifiedPaths = Object.keys(current)
        .filter(
            (path) =>
                path in repository.files &&
                repository.files[path].content !== current[path],
        )
        .sort()
    const deletedPaths = Object.keys(repository.files)
        .filter((path) => !(path in current))
        .sort()
    const changedPaths = [...addedPaths, ...modifiedPaths].sort()
    return {
        addedPaths,
        modifiedPaths,
        deletedPaths,
        changedPaths,
        sensitivePaths: changedPaths.filter(isSensitiveGitHubPath),
        hasChanges: changedPaths.length > 0 || deletedPaths.length > 0,
    }
}

function assertSensitivePathsConfirmed(
    preview: GitHubPushPreview,
    options: GitHubPushOptions,
): void {
    const confirmed = new Set(options.confirmedSensitivePaths ?? [])
    const unconfirmed = preview.sensitivePaths.filter((path) => !confirmed.has(path))
    if (unconfirmed.length > 0) {
        throw new GitHubApiError(
            `Explicit confirmation is required before uploading sensitive path${unconfirmed.length === 1 ? "" : "s"}: ${unconfirmed.join(", ")}`,
            400,
            "SENSITIVE_FILES_REQUIRE_CONFIRMATION",
            preview,
        )
    }
}

export async function pushGitHubRepository(
    token: string,
    repository: GitHubImportedRepository,
    fileStructure: FileSystemItem,
    message: string,
    options: GitHubPushOptions = {},
    activeFile?: FileSystemItem | null,
): Promise<GitHubPushResult> {
    const commitMessage = message.trim()
    if (!commitMessage) throw new GitHubApiError("Enter a commit message")
    if (commitMessage.length > MAX_COMMIT_MESSAGE_LENGTH) {
        throw new GitHubApiError(
            `Commit messages must be ${MAX_COMMIT_MESSAGE_LENGTH} characters or fewer`,
        )
    }

    const preview = createGitHubPushPreview(repository, fileStructure, activeFile)
    assertSensitivePathsConfirmed(preview, options)
    if (!preview.hasChanges) {
        return {
            repository,
            commitSha: repository.headCommitSha,
            treeSha: repository.baseTreeSha,
            changedFiles: 0,
            deletedFiles: 0,
        }
    }

    const repositoryPath = `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}`
    // Check immediately before creating any blob/tree/commit. The final ref
    // update also uses force:false, so a race cannot overwrite a newer head.
    const latestRef = await requestGitHub<GitHubRefResponse>(
        `${repositoryPath}/git/ref/heads/${encodePath(repository.branch)}`,
        token,
        { signal: options.signal },
    )
    const latestHead = latestRef.object?.sha
    if (!latestHead || latestHead !== repository.headCommitSha) {
        throw new GitHubApiError(
            "The remote branch changed since import. Import again before pushing.",
            409,
            "REMOTE_HEAD_CHANGED",
            preview,
        )
    }

    const current = currentFiles(fileStructure, activeFile)
    const treeEntries: Array<{
        path: string
        mode: string
        type: "blob"
        sha: string | null
    }> = []
    const updatedFiles: Record<string, GitHubRemoteFile> = { ...repository.files }

    for (const path of preview.changedPaths) {
        const blob = await requestGitHub<GitHubBlobResponse>(
            `${repositoryPath}/git/blobs`,
            token,
            {
                method: "POST",
                signal: options.signal,
                body: JSON.stringify({
                    content: encodeBase64(current[path]),
                    encoding: "base64",
                }),
            },
        )
        const mode = repository.files[path]?.mode === "100755" ? "100755" : "100644"
        treeEntries.push({ path, mode, type: "blob", sha: blob.sha })
        updatedFiles[path] = { sha: blob.sha, content: current[path], mode }
    }

    for (const path of preview.deletedPaths) {
        treeEntries.push({
            path,
            mode: repository.files[path]?.mode === "100755" ? "100755" : "100644",
            type: "blob",
            sha: null,
        })
        delete updatedFiles[path]
    }

    const tree = await requestGitHub<GitHubTreeResponse>(
        `${repositoryPath}/git/trees`,
        token,
        {
            method: "POST",
            signal: options.signal,
            body: JSON.stringify({
                base_tree: repository.baseTreeSha,
                tree: treeEntries,
            }),
        },
    )
    if (!tree.sha) throw new GitHubApiError("GitHub did not return the new tree")

    const createdCommit = await requestGitHub<GitHubCreatedCommitResponse>(
        `${repositoryPath}/git/commits`,
        token,
        {
            method: "POST",
            signal: options.signal,
            body: JSON.stringify({
                message: commitMessage,
                tree: tree.sha,
                parents: [repository.headCommitSha],
            }),
        },
    )
    if (!createdCommit.sha) throw new GitHubApiError("GitHub did not return the new commit")

    const ref = `heads/${encodePath(repository.branch)}`
    await requestGitHub(
        `${repositoryPath}/git/refs/${ref}`,
        token,
        {
            method: "PATCH",
            signal: options.signal,
            body: JSON.stringify({ sha: createdCommit.sha, force: false }),
        },
    )

    // Construct the next baseline only after the ref write succeeds. On any
    // error above, callers retain the old baseline and can retry safely.
    const nextRepository: GitHubImportedRepository = {
        ...repository,
        headCommitSha: createdCommit.sha,
        baseTreeSha: tree.sha,
        files: updatedFiles,
    }
    return {
        repository: nextRepository,
        commitSha: createdCommit.sha,
        treeSha: tree.sha,
        changedFiles: preview.changedPaths.length,
        deletedFiles: preview.deletedPaths.length,
    }
}

export async function getGitHubUser(
    token: string,
    signal?: AbortSignal,
): Promise<{ login: string }> {
    return requestGitHub<{ login: string }>("/user", token, { signal })
}
