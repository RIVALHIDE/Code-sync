import { FileSystemItem } from "./file"

/** GitHub OAuth is always brokered by the Code Sync backend. */
export type GitHubAuthSource = "backend"

export interface GitHubAuthConfiguration {
    configured: boolean
    source: GitHubAuthSource | null
}

export interface GitHubDeviceCode {
    device_code: string
    user_code: string
    verification_uri: string
    verification_uri_complete?: string
    expires_in: number
    interval?: number
}

export interface GitHubRepositoryInput {
    owner: string
    name: string
}

export interface GitHubRemoteFile {
    sha: string
    content: string
    /** Git tree mode, normally 100644 or 100755. */
    mode?: string
}

export interface GitHubImportedRepository {
    owner: string
    name: string
    branch: string
    /** The branch head captured before the import. */
    headCommitSha: string
    /** The complete captured commit tree used as push base_tree. */
    baseTreeSha: string
    files: Record<string, GitHubRemoteFile>
}

export interface GitHubImportResult {
    repository: GitHubImportedRepository
    fileStructure: FileSystemItem[]
    /** Binary, symlink, submodule, and over-limit paths are not editable text files. */
    skippedFiles: string[]
}

export interface GitHubPushPreview {
    addedPaths: string[]
    modifiedPaths: string[]
    deletedPaths: string[]
    changedPaths: string[]
    sensitivePaths: string[]
    hasChanges: boolean
}

export interface GitHubPushOptions {
    /** Every sensitive path must be explicitly acknowledged by the user. */
    confirmedSensitivePaths?: string[]
    signal?: AbortSignal
}

export interface GitHubPushResult {
    repository: GitHubImportedRepository
    commitSha: string
    treeSha: string
    changedFiles: number
    deletedFiles: number
}

export interface GitHubContextValue {
    configuration: GitHubAuthConfiguration | null
    configurationError: string
    tokenPresent: boolean
    githubLogin: string
    deviceCode: GitHubDeviceCode | null
    authLoading: boolean
    repository: GitHubImportedRepository | null
    repositoryScope: string | null
    busyAction: "import" | "push" | null
    error: string
    status: string
    signIn: () => Promise<void>
    signOut: () => void
    importRepository: (
        input: GitHubRepositoryInput,
    ) => Promise<GitHubImportResult>
    previewPush: (
        fileStructure: FileSystemItem,
        activeFile?: FileSystemItem | null,
    ) => GitHubPushPreview | null
    pushRepository: (
        fileStructure: FileSystemItem,
        activeFile: FileSystemItem | null,
        message: string,
        options?: GitHubPushOptions,
    ) => Promise<GitHubPushResult>
    cancel: () => void
    clearMessages: () => void
}
