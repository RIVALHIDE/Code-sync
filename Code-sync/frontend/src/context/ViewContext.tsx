import ChatsView from "@/components/sidebar/sidebar-views/ChatsView"
import CopilotView from "@/components/sidebar/sidebar-views/CopilotView"
import FilesView from "@/components/sidebar/sidebar-views/FilesView"
import GitHubView from "@/components/sidebar/sidebar-views/GitHubView"
import RunView from "@/components/sidebar/sidebar-views/RunView"
import SettingsView from "@/components/sidebar/sidebar-views/SettingsView"
import UsersView from "@/components/sidebar/sidebar-views/UsersView"
import VideoCallView from "@/components/sidebar/sidebar-views/VideoCallView"
import RecordingView from "@/components/sidebar/sidebar-views/RecordingView"
import CoPromptView from "@/components/sidebar/sidebar-views/CoPromptView"
import VoiceView from "@/components/sidebar/sidebar-views/VoiceView"
import DashboardView from "@/components/sidebar/sidebar-views/DashboardView"
import useWindowDimensions from "@/hooks/useWindowDimensions"
import { VIEWS, ViewContext as ViewContextType } from "@/types/view"
import { ReactNode, createContext, useContext, useState } from "react"
import { IoSettingsOutline } from "react-icons/io5"
import { LuFiles, LuSparkles, LuLayoutDashboard } from "react-icons/lu"
import { PiChats, PiPlay, PiUsers, PiWaveform } from "react-icons/pi"
import { MdVideoCall } from "react-icons/md"
import { LuCircleDot } from "react-icons/lu"
import { PiMagicWand } from "react-icons/pi"
import { FaGithub } from "react-icons/fa"

const ViewContext = createContext<ViewContextType | null>(null)

export const useViews = (): ViewContextType => {
    const context = useContext(ViewContext)
    if (!context) {
        throw new Error("useViews must be used within a ViewContextProvider")
    }
    return context
}

function ViewContextProvider({ children }: { children: ReactNode }) {
    const { isMobile } = useWindowDimensions()
    const [activeView, setActiveView] = useState<VIEWS>(VIEWS.FILES)
    const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(!isMobile)
    const [viewComponents] = useState({
        [VIEWS.FILES]: <FilesView />,
        [VIEWS.CLIENTS]: <UsersView />,
        [VIEWS.GITHUB]: <GitHubView />,
        [VIEWS.SETTINGS]: <SettingsView />,
        [VIEWS.COPILOT]: <CopilotView />,
        [VIEWS.CHATS]: <ChatsView />,
        [VIEWS.RUN]: <RunView />,
        [VIEWS.VIDEO_CALL]: <VideoCallView />,
        [VIEWS.RECORDINGS]: <RecordingView />,
        [VIEWS.CO_PROMPT]: <CoPromptView />,
        [VIEWS.VOICE]: <VoiceView />,
        [VIEWS.DASHBOARD]: <DashboardView />,
    })
    const [viewIcons] = useState({
        [VIEWS.FILES]: <LuFiles size={28} />,
        [VIEWS.CLIENTS]: <PiUsers size={30} />,
        [VIEWS.GITHUB]: <FaGithub size={28} />,
        [VIEWS.SETTINGS]: <IoSettingsOutline size={28} />,
        [VIEWS.CHATS]: <PiChats size={30} />,
        [VIEWS.COPILOT]: <LuSparkles size={28} />,
        [VIEWS.RUN]: <PiPlay size={28} />,
        [VIEWS.VIDEO_CALL]: <MdVideoCall size={30} />,
        [VIEWS.RECORDINGS]: <LuCircleDot size={26} />,
        [VIEWS.CO_PROMPT]: <PiMagicWand size={28} />,
        [VIEWS.VOICE]: <PiWaveform size={28} />,
        [VIEWS.DASHBOARD]: <LuLayoutDashboard size={26} />,
    })

    return (
        <ViewContext.Provider
            value={{
                activeView,
                setActiveView,
                isSidebarOpen,
                setIsSidebarOpen,
                viewComponents,
                viewIcons,
            }}
        >
            {children}
        </ViewContext.Provider>
    )
}

export { ViewContextProvider }
export default ViewContext
