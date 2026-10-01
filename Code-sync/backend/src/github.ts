import { Request, Response, Router } from "express"

const router = Router()

const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code"
const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token"
const GITHUB_API_URL = "https://api.github.com"
const MAX_DEVICE_CODE_LENGTH = 512
const MAX_ACCESS_TOKEN_LENGTH = 512
const MAX_PROXY_PATH_LENGTH = 2048
const ALLOWED_SCOPES = new Set(["repo", "read:user", "user:email"])
const NO_STORE_HEADERS = {
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
}

function getClientId(): string {
    return process.env.GITHUB_CLIENT_ID?.trim() ?? ""
}

/**
 * Browser origins are deliberately an explicit deployment setting. Do not use
 * `*` here: this router accepts a bearer token for the stateless GitHub proxy.
 */
export function getAllowedGitHubOrigins(): string[] {
    return (process.env.GITHUB_ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((origin) => origin.trim().replace(/\/$/, ""))
        .filter(Boolean)
}

function originIsAllowed(request: Request): boolean {
    const origin = request.get("origin")
    const allowedOrigins = getAllowedGitHubOrigins()
    // A request without Origin is normally same-origin/server-to-server. A
    // browser request must always match the explicit allowlist.
    return !origin || allowedOrigins.includes(origin)
}

function isValidDeviceCode(value: unknown): value is string {
    return (
        typeof value === "string" &&
        value.length > 0 &&
        value.length <= MAX_DEVICE_CODE_LENGTH &&
        /^[a-zA-Z0-9_.-]+$/.test(value)
    )
}

function isValidAccessToken(value: unknown): value is string {
    return (
        typeof value === "string" &&
        value.length > 0 &&
        value.length <= MAX_ACCESS_TOKEN_LENGTH &&
        /^[a-zA-Z0-9_.-]+$/.test(value)
    )
}

function requestedScope(value: unknown): string {
    if (typeof value !== "string" || value.trim() === "") return "repo"
    const scopes = value
        .split(/[ ,]+/)
        .map((scope) => scope.trim())
        .filter(Boolean)
    if (scopes.length === 0 || scopes.some((scope) => !ALLOWED_SCOPES.has(scope))) {
        return ""
    }
    return [...new Set(scopes)].join(" ")
}

async function githubJson(
    url: string,
    init: RequestInit,
): Promise<{ response: globalThis.Response; data: unknown }> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)
    try {
        const response = await fetch(url, {
            ...init,
            signal: controller.signal,
            headers: {
                Accept: "application/json",
                ...(init.headers ?? {}),
            },
        })
        const data = await response.json().catch(() => ({}))
        return { response, data }
    } finally {
        clearTimeout(timeout)
    }
}

function asRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {}
}

function safeOAuthResponse(value: unknown): Record<string, unknown> {
    const source = asRecord(value)
    const allowed = [
        "device_code",
        "user_code",
        "verification_uri",
        "verification_uri_complete",
        "expires_in",
        "interval",
        "access_token",
        "token_type",
        "scope",
        "error",
        "error_description",
    ]
    return Object.fromEntries(
        allowed
            .filter((key) => key in source)
            .map((key) => [key, source[key]]),
    )
}

function proxyPathIsAllowed(value: unknown): value is string {
    if (
        typeof value !== "string" ||
        value.length === 0 ||
        value.length > MAX_PROXY_PATH_LENGTH ||
        !value.startsWith("/") ||
        value.includes("\\") ||
        value.includes("..") ||
        /[\u0000-\u001f\u007f]/.test(value)
    ) {
        return false
    }

    try {
        const url = new URL(value, GITHUB_API_URL)
        if (url.origin !== GITHUB_API_URL || url.hash) return false
        const pathname = url.pathname
        return pathname === "/user" || /^\/repos\/[^/]+\/[^/]+(?:\/.*)?$/.test(pathname)
    } catch {
        return false
    }
}

function proxyMethodIsAllowed(value: unknown): value is "GET" | "POST" | "PATCH" {
    return value === "GET" || value === "POST" || value === "PATCH"
}

function proxyBodyIsSafe(value: unknown): boolean {
    if (value === undefined) return true
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false
    try {
        return JSON.stringify(value).length <= 2 * 1024 * 1024
    } catch {
        return false
    }
}

router.use((request, response, next) => {
    response.set(NO_STORE_HEADERS)
    if (!originIsAllowed(request)) {
        response.status(403).json({ error: "Origin is not allowed" })
        return
    }
    next()
})

/** The OAuth client id is public configuration; the client secret never exists in this app. */
router.get("/config", (_request, response) => {
    response.set(NO_STORE_HEADERS).json({
        configured: Boolean(getClientId()),
        source: getClientId() ? "backend" : null,
    })
})

router.post("/device/code", async (request, response) => {
    const clientId = getClientId()
    if (!clientId) {
        response.status(503).json({ error: "GitHub OAuth is not configured" })
        return
    }

    const scope = requestedScope(request.body?.scope)
    if (!scope) {
        response.status(400).json({ error: "Unsupported GitHub OAuth scope" })
        return
    }

    try {
        const { response: githubResponse, data } = await githubJson(
            GITHUB_DEVICE_CODE_URL,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Accept: "application/json",
                },
                body: new URLSearchParams({ client_id: clientId, scope }).toString(),
            },
        )
        const payload = safeOAuthResponse(data)
        if (
            !githubResponse.ok ||
            typeof payload.device_code !== "string" ||
            typeof payload.user_code !== "string"
        ) {
            response.status(502).json({ error: "GitHub device authorization failed" })
            return
        }
        response.json(payload)
    } catch {
        response.status(502).json({ error: "GitHub device authorization failed" })
    }
})

router.post("/device/token", async (request, response) => {
    const clientId = getClientId()
    if (!clientId) {
        response.status(503).json({ error: "GitHub OAuth is not configured" })
        return
    }

    const deviceCode = request.body?.device_code
    if (!isValidDeviceCode(deviceCode)) {
        response.status(400).json({ error: "A valid device code is required" })
        return
    }

    try {
        const { response: githubResponse, data } = await githubJson(
            GITHUB_ACCESS_TOKEN_URL,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    client_id: clientId,
                    device_code: deviceCode,
                    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
                }),
            },
        )
        const payload = safeOAuthResponse(data)
        // Preserve GitHub's pending/slow_down/expired codes for polling, but
        // never log or echo arbitrary upstream fields.
        if (!githubResponse.ok && typeof payload.error !== "string") {
            response.status(502).json({ error: "GitHub token exchange failed" })
            return
        }
        response.status(githubResponse.ok ? 200 : 400).json(payload)
    } catch {
        response.status(502).json({ error: "GitHub token exchange failed" })
    }
})

/**
 * Stateless GitHub API proxy. The browser keeps its OAuth token in
 * sessionStorage and sends it only over HTTPS to this backend. It is never
 * placed in a socket payload, response body, cache, or log.
 */
router.post("/request", async (request, response) => {
    const authorization = request.get("authorization") ?? ""
    const token = authorization.replace(/^Bearer\s+/i, "")
    const path = request.body?.path
    const method = request.body?.method ?? "GET"
    const body = request.body?.body

    if (!isValidAccessToken(token)) {
        response.status(401).json({ error: "A valid GitHub access token is required" })
        return
    }
    if (!proxyPathIsAllowed(path)) {
        response.status(400).json({ error: "Unsupported GitHub API path" })
        return
    }
    if (!proxyMethodIsAllowed(method) || !proxyBodyIsSafe(body)) {
        response.status(400).json({ error: "Unsupported GitHub API request" })
        return
    }

    try {
        const { response: githubResponse, data } = await githubJson(
            `${GITHUB_API_URL}${path}`,
            {
                method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    "X-GitHub-Api-Version": "2022-11-28",
                    "User-Agent": "Code-Sync",
                    ...(body === undefined ? {} : { "Content-Type": "application/json" }),
                },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            },
        )
        // GitHub JSON can be an object or array. Do not add the Authorization
        // header or any upstream token-bearing fields to this response.
        response.status(githubResponse.status).json(data)
    } catch {
        response.status(502).json({ error: "GitHub request failed" })
    }
})

export default router
