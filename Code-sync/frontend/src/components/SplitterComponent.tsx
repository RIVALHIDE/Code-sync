import { useViews } from "@/context/ViewContext"
import useLocalStorage from "@/hooks/useLocalStorage"
import useWindowDimensions from "@/hooks/useWindowDimensions"
import { ReactNode, useState } from "react"
import Split from "react-split"

const RAIL_WIDTH = 76
const DEFAULT_PANEL_WIDTH = 392

function SplitterComponent({ children }: { children: ReactNode }) {
    const { isSidebarOpen } = useViews()
    const { isMobile, width } = useWindowDimensions()
    const { setItem, getItem } = useLocalStorage()
    const [panelWidth, setPanelWidth] = useState(() => {
        const saved = Number(getItem("workspacePanelWidth"))
        return Number.isFinite(saved) && saved >= 340
            ? saved
            : DEFAULT_PANEL_WIDTH
    })
    const availableWidth = Math.max(width - 24, 1)
    const maxPanelWidth = Math.min(540, availableWidth - 320)
    const sidebarWidth = isMobile
        ? 0
        : isSidebarOpen
          ? Math.max(340, Math.min(panelWidth, maxPanelWidth))
          : RAIL_WIDTH
    const sidebarPercent = (sidebarWidth / availableWidth) * 100

    return (
        <Split
            sizes={[sidebarPercent, 100 - sidebarPercent]}
            minSize={
                isMobile ? [0, 0] : isSidebarOpen ? [340, 320] : [RAIL_WIDTH, 0]
            }
            maxSize={[
                isMobile ? 0 : isSidebarOpen ? maxPanelWidth : RAIL_WIDTH,
                Infinity,
            ]}
            gutterSize={isSidebarOpen && !isMobile ? 5 : 0}
            gutter={(index, direction) => {
                const gutter = document.createElement("div")
                gutter.className = `workspace-gutter gutter-${direction}`
                gutter.setAttribute("role", "separator")
                gutter.setAttribute("aria-label", "Resize tools panel")
                gutter.setAttribute("aria-orientation", "vertical")
                gutter.dataset.index = String(index)
                return gutter
            }}
            direction="horizontal"
            cursor="col-resize"
            snapOffset={0}
            onDragEnd={(sizes: number[]) => {
                if (!isSidebarOpen || isMobile) return
                const nextWidth = Math.round((sizes[0] / 100) * availableWidth)
                setPanelWidth(nextWidth)
                setItem("workspacePanelWidth", String(nextWidth))
            }}
            className="workspace-split"
        >
            {children}
        </Split>
    )
}

export default SplitterComponent
