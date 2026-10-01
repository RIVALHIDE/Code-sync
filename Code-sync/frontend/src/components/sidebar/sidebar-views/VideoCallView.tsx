import VideoCall from "@/components/video/VideoCall"

function VideoCallView() {
    return (
        <section className="video-call-panel" aria-label="Video call">
            <header className="video-panel-header">
                <span>COLLABORATE</span>
                <h1>Video call</h1>
                <p>See your team while you build.</p>
            </header>
            <VideoCall />
        </section>
    )
}

export default VideoCallView
