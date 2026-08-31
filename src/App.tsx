import { useState, useCallback } from "react";
import Home from "./pages/Home";
import Analyzing from "./pages/Analyzing";
import DownloadSetup from "./pages/DownloadSetup";
import Downloading from "./pages/Downloading";
import DownloadComplete from "./pages/DownloadComplete";
import DownloadErrorScreen from "./pages/DownloadError";
import SettingsPage from "./pages/Settings";
import BottomNav from "./components/BottomNav";
import type { NavItem } from "./types/navigation";
import type { DownloadingInfo, CompletedDownload, DownloadError as DownloadErrorType } from "./types/download";

type HomeScreen = "idle" | "analyzing" | "setup" | "downloading" | "complete" | "error";

const MOCK_DOWNLOAD_INFO: DownloadingInfo = {
  title: "The Future of Urban Music and Culture",
  thumbnailUrl: "",
  format: "MP4",
  quality: "1080p60",
  progress: 42,
  downloaded: "84 MB",
  total: "200 MB",
  speed: "3.8 MB/s",
  eta: "00:31",
};

const MOCK_ERROR: DownloadErrorType = {
  title: "Couldn't download this video",
  message: "Something went wrong while processing the YouTube link. Please check your connection or the link itself.",
};

const MOCK_COMPLETED: CompletedDownload = {
  title: "Designing for the Future: Minimalist UI in 2024",
  type: "video",
  format: "MP4",
  size: "142.5 MB",
  duration: "10:45",
  thumbnailUrl: "",
};

function App() {
  const [activeNav, setActiveNav] = useState<NavItem>("home");
  const [homeScreen, setHomeScreen] = useState<HomeScreen>("idle");
  const [analyzingUrl, setAnalyzingUrl] = useState("");

  const handleAnalyze = useCallback((url: string) => {
    setAnalyzingUrl(url);
    setHomeScreen("analyzing");
  }, []);

  const handleAnalysisComplete = useCallback(() => {
    setHomeScreen("setup");
  }, []);

  const handleBackToHome = useCallback(() => {
    setHomeScreen("idle");
    setAnalyzingUrl("");
  }, []);

  const handleBackToAnalyzing = useCallback(() => {
    setHomeScreen("analyzing");
  }, []);

  const handleStartDownload = useCallback(() => {
    setHomeScreen("downloading");
  }, []);

  const handleCancelDownload = useCallback(() => {
    setHomeScreen("setup");
  }, []);

  const handleDownloadComplete = useCallback(() => {
    setHomeScreen("complete");
  }, []);

  const handleOpenFile = useCallback(() => {
    console.log("Open file:", MOCK_COMPLETED);
  }, []);

  const handleDownloadAnother = useCallback(() => {
    setHomeScreen("idle");
    setAnalyzingUrl("");
  }, []);

  const handleTryAgain = useCallback(() => {
    setHomeScreen("analyzing");
  }, []);

  const handleChangeLink = useCallback(() => {
    setHomeScreen("idle");
    setAnalyzingUrl("");
  }, []);

  const showBottomNav =
    activeNav !== "home" ||
    homeScreen === "idle" ||
    homeScreen === "setup";

  return (
    <div className="w-full min-h-screen bg-bg-primary relative">
      {/* Main content area */}
      {activeNav === "home" && homeScreen === "idle" && (
        <Home onAnalyze={handleAnalyze} />
      )}
      {activeNav === "home" && homeScreen === "analyzing" && (
        <Analyzing
          url={analyzingUrl}
          onBack={handleBackToHome}
          onComplete={handleAnalysisComplete}
        />
      )}
      {activeNav === "home" && homeScreen === "setup" && (
        <DownloadSetup
          onBack={handleBackToAnalyzing}
          onDownload={handleStartDownload}
        />
      )}
      {activeNav === "home" && homeScreen === "downloading" && (
        <Downloading
          info={MOCK_DOWNLOAD_INFO}
          onBack={() => setHomeScreen("setup")}
          onCancel={handleCancelDownload}
          onComplete={handleDownloadComplete}
        />
      )}
      {activeNav === "home" && homeScreen === "complete" && (
        <DownloadComplete
          file={MOCK_COMPLETED}
          onOpenFile={handleOpenFile}
          onDownloadAnother={handleDownloadAnother}
        />
      )}
      {activeNav === "home" && homeScreen === "error" && (
        <DownloadErrorScreen
          error={MOCK_ERROR}
          onTryAgain={handleTryAgain}
          onChangeLink={handleChangeLink}
        />
      )}

      {/* Placeholder screens for other tabs */}
      {activeNav === "history" && (
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-text-secondary text-[15px]">History</p>
        </div>
      )}
      {activeNav === "settings" && (
        <SettingsPage onBack={() => setActiveNav("home")} />
      )}

      {/* Bottom navigation — hidden on downloading/complete screens */}
      {showBottomNav && (
        <BottomNav active={activeNav} onChange={setActiveNav} />
      )}
    </div>
  );
}

export default App;
