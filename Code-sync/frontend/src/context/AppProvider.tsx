import { ReactNode } from "react"
import { AppContextProvider } from "./AppContext.js"
import { ChatContextProvider } from "./ChatContext.jsx"
import { FileContextProvider } from "./FileContext.jsx"
import { RunCodeContextProvider } from "./RunCodeContext.jsx"
import { SettingContextProvider } from "./SettingContext.jsx"
import { SocketProvider } from "./SocketContext.jsx"
import { ViewContextProvider } from "./ViewContext.js"
import { CopilotContextProvider } from "./CopilotContext.js"
import { VideoCallContextProvider } from "./VideoCallContext"
import { PedagogicalAIContextProvider } from "./PedagogicalAIContext"
import { RecordingContextProvider } from "./RecordingContext"

function AppProvider({ children }: { children: ReactNode }) {
    return (
        <AppContextProvider>
            <SocketProvider>
                <SettingContextProvider>
                    <ViewContextProvider>
                        <FileContextProvider>
                            <CopilotContextProvider>
                                <RunCodeContextProvider>
                                    <PedagogicalAIContextProvider>
                                        <RecordingContextProvider>
                                            <ChatContextProvider>
                                                <VideoCallContextProvider>
                                                    {children}
                                                </VideoCallContextProvider>
                                            </ChatContextProvider>
                                        </RecordingContextProvider>
                                    </PedagogicalAIContextProvider>
                                </RunCodeContextProvider>
                            </CopilotContextProvider>
                        </FileContextProvider>
                    </ViewContextProvider>
                </SettingContextProvider>
            </SocketProvider>
        </AppContextProvider>
    )
}

export default AppProvider
