enum VIEWS {
    FILES = "FILES",
    CHATS = "CHATS",
    CLIENTS = "CLIENTS",
    RUN = "RUN",
    COPILOT = "COPILOT",
    GITHUB = "GITHUB",
    SETTINGS = "SETTINGS",
    VIDEO_CALL = "VIDEO_CALL",
    RECORDINGS = "RECORDINGS",
    CO_PROMPT = "CO_PROMPT",
    VOICE = "VOICE",
    DASHBOARD = "DASHBOARD",
}

interface ViewContext {
    activeView: VIEWS
    setActiveView: (activeView: VIEWS) => void
    isSidebarOpen: boolean
    setIsSidebarOpen: (isSidebarOpen: boolean) => void
    viewComponents: { [key in VIEWS]: JSX.Element }
    viewIcons: { [key in VIEWS]: JSX.Element }
}

export { ViewContext, VIEWS }
