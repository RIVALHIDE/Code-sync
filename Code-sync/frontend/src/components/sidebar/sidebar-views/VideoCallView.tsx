import VideoCall from "@/components/video/VideoCall"
import useResponsive from "@/hooks/useResponsive"

function VideoCallView() {
    const { viewHeight } = useResponsive()

    return (
        <div
            className="flex w-full flex-col"
            style={{ height: viewHeight }}
        >
            <h1 className="view-title px-4 pt-4">Video Call</h1>
            <VideoCall />
        </div>
    )
}

export default VideoCallView
