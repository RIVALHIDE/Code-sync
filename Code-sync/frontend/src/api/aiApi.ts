import axios, { AxiosInstance } from "axios"

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000"

const instance: AxiosInstance = axios.create({
    baseURL: BACKEND_URL,
    headers: {
        "Content-Type": "application/json",
    },
})

/**
 * Call the AI chat proxy on our own backend.
 * Returns the assistant's reply as a plain string.
 */
export async function callAIProxy(
    messages: Array<{ role: string; content: string }>,
    model = "openai-fast",
): Promise<string> {
    const response = await instance.post("/api/ai/chat", { messages, model })
    return response.data.content as string
}

export default instance
