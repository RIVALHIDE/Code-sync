import Select from "@/components/common/Select"
import { useSettings } from "@/context/SettingContext"
import useResponsive from "@/hooks/useResponsive"
import { editorFonts } from "@/resources/Fonts"
import { editorThemes } from "@/resources/Themes"
import { langNames } from "@uiw/codemirror-extensions-langs"
import { ChangeEvent, useEffect } from "react"

function SettingsView() {
    const {
        theme,
        setTheme,
        language,
        setLanguage,
        fontSize,
        setFontSize,
        fontFamily,
        setFontFamily,
        showGitHubCorner,
        setShowGitHubCorner,
        enableLinting,
        setEnableLinting,
        resetSettings,
    } = useSettings()
    const { viewHeight } = useResponsive()

    const handleFontFamilyChange = (e: ChangeEvent<HTMLSelectElement>) =>
        setFontFamily(e.target.value)
    const handleThemeChange = (e: ChangeEvent<HTMLSelectElement>) =>
        setTheme(e.target.value)
    const handleLanguageChange = (e: ChangeEvent<HTMLSelectElement>) =>
        setLanguage(e.target.value)
    const handleFontSizeChange = (e: ChangeEvent<HTMLSelectElement>) =>
        setFontSize(parseInt(e.target.value))
    const handleShowGitHubCornerChange = (e: ChangeEvent<HTMLInputElement>) =>
        setShowGitHubCorner(e.target.checked)
    const handleEnableLintingChange = (e: ChangeEvent<HTMLInputElement>) =>
        setEnableLinting(e.target.checked)

    useEffect(() => {
        // Set editor font family
        const editor = document.querySelector(
            ".cm-editor > .cm-scroller",
        ) as HTMLElement
        if (editor !== null) {
            editor.style.fontFamily = `${fontFamily}, monospace`
        }
    }, [fontFamily])

    return (
        <div
            className="sidebar-panel sidebar-panel--settings"
            style={{ height: viewHeight }}
        >
            <div className="sidebar-panel-header">
                <h1 className="sidebar-panel-title">Editor settings</h1>
            </div>
            {/* Choose Font Family option */}
            <div className="sidebar-settings-font-row">
                <Select
                    onChange={handleFontFamilyChange}
                    value={fontFamily}
                    options={editorFonts}
                    title="Font Family"
                />
                {/* Choose font size option */}
                <div className="sidebar-panel-field">
                    <label htmlFor="editor-font-size">Size</label>
                    <select
                        id="editor-font-size"
                        value={fontSize}
                        onChange={handleFontSizeChange}
                        className="sidebar-settings-size"
                        title="Font Size"
                    >
                        {[...Array(13).keys()].map((size) => (
                            <option key={size} value={size + 12}>
                                {size + 12}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            {/* Choose theme option */}
            <Select
                onChange={handleThemeChange}
                value={theme}
                options={Object.keys(editorThemes)}
                title="Theme"
            />
            {/* Choose language option */}
            <Select
                onChange={handleLanguageChange}
                value={language}
                options={langNames}
                title="Language"
            />
            {/* Show GitHub corner option */}
            <div className="sidebar-settings-toggle-row">
                <span id="github-corner-label">Show GitHub corner</span>
                <label className="sidebar-settings-toggle">
                    <input
                        className="peer sr-only"
                        type="checkbox"
                        onChange={handleShowGitHubCornerChange}
                        checked={showGitHubCorner}
                        aria-labelledby="github-corner-label"
                    />
                    <span className="sidebar-settings-toggle-track" />
                </label>
            </div>
            {/* Enable linting option */}
            <div className="sidebar-settings-toggle-row">
                <div className="min-w-0 flex flex-col">
                    <span id="code-linting-label">Code quality linting</span>
                    <span className="text-xs text-white/40">
                        Real-time style &amp; error checks
                    </span>
                </div>
                <label className="sidebar-settings-toggle">
                    <input
                        className="peer sr-only"
                        type="checkbox"
                        onChange={handleEnableLintingChange}
                        checked={enableLinting}
                        aria-labelledby="code-linting-label"
                    />
                    <span className="sidebar-settings-toggle-track" />
                </label>
            </div>
            <button
                className="sidebar-panel-button sidebar-settings-reset"
                onClick={resetSettings}
            >
                Reset to default
            </button>
        </div>
    )
}

export default SettingsView
