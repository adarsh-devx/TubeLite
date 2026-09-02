import Home from "./pages/Home";
import Analyzing from "./pages/Analyzing";
import DownloadSetup from "./pages/DownloadSetup";
import Downloading from "./pages/Downloading";
import DownloadComplete from "./pages/DownloadComplete";
import DownloadErrorScreen from "./pages/DownloadError";
import SettingsPage from "./pages/Settings";
import BottomNav from "./components/BottomNav";
import { useDownloadFlow } from "./hooks/useDownloadFlow";

const HIDE_BOTTOM_NAV_SCREENS = new Set([
  "downloading",
  "complete",
  "error",
  "analyzing",
]);

function App() {
  const {
    screen,
    navTab,
    url,
    videoInfo,
    videoFormats,
    audioFormats,
    selectedFormat,
    downloadingInfo,
    completedDownload,
    error,
    stage,
    handleAnalysisComplete,
    handleAnalyze,
    handleSelectFormat,
    handleStartDownload,
    handleCancelDownload,

    handleOpenFile,
    handleDownloadAnother,
    handleTryAgain,
    handleChangeLink,
    handleBackToHome,
    handleBackToAnalyzing,
    handleBackToSetup,
    handleNavChange,
    handleSettingsBack,
  } = useDownloadFlow();

  const showBottomNav =
    navTab !== "home" || !HIDE_BOTTOM_NAV_SCREENS.has(screen);

  return (
    <div className="w-full min-h-screen bg-bg-primary relative">
      {/* === Home download flow screens === */}
      {screen === "home" && navTab === "home" && (
        <Home onAnalyze={handleAnalyze} />
      )}
      {screen === "analyzing" && (
        <Analyzing
          url={url}
          onBack={handleBackToHome}
          onComplete={handleAnalysisComplete}
        />
      )}
      {screen === "setup" && (
        <DownloadSetup
          videoInfo={videoInfo}
          videoFormats={videoFormats}
          audioFormats={audioFormats}
          selectedFormat={selectedFormat}
          onSelectFormat={handleSelectFormat}
          onBack={handleBackToAnalyzing}
          onDownload={handleStartDownload}
        />
      )}
      {screen === "downloading" && downloadingInfo && (
        <Downloading
          info={downloadingInfo}
          onBack={handleBackToSetup}
          onCancel={handleCancelDownload}
          stage={stage}
        />
      )}
      {screen === "complete" && completedDownload && (
        <DownloadComplete
          file={completedDownload}
          onOpenFile={handleOpenFile}
          onDownloadAnother={handleDownloadAnother}
        />
      )}
      {screen === "error" && error && (
        <DownloadErrorScreen
          error={error}
          onTryAgain={handleTryAgain}
          onChangeLink={handleChangeLink}
        />
      )}

      {/* === Tab-based screens === */}
      {navTab === "history" && screen !== "settings" && (
        <div className="min-h-screen flex items-center justify-center pb-24">
          <p className="text-text-secondary text-[15px]">No history yet</p>
        </div>
      )}
      {navTab === "settings" && (
        <SettingsPage onBack={handleSettingsBack} />
      )}

      {/* === Bottom navigation === */}
      {showBottomNav && (
        <BottomNav active={navTab} onChange={handleNavChange} />
      )}
    </div>
  );
}

export default App;
