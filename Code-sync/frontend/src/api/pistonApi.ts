import axios, { AxiosInstance } from "axios"

const pistonBaseUrl = import.meta.env.VITE_PISTON_API_URL || "/piston/api/v2"

const instance: AxiosInstance = axios.create({
    baseURL: pistonBaseUrl,
    headers: {
        "Content-Type": "application/json",
    },
})

export default instance
