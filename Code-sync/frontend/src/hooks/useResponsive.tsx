import useWindowDimensions from "./useWindowDimensions"

// Panels size to their workspace container, not the viewport. This keeps their
// scroll areas above the toolbar/status bar and works when the keyboard opens.
function useResponsive() {
    const { height, isMobile } = useWindowDimensions()
    const minHeightReached = isMobile && height < 500
    return { viewHeight: "100%", minHeightReached }
}

export default useResponsive
