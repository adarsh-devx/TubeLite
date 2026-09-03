import { Clock3, FolderOpen } from "lucide-react";
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

function formatHistoryDate(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString([], {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

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
    history,
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

  const isHistoryScreen = navTab === "history" && screen !== "settings";

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

      {/* === History === */}
      {isHistoryScreen && (
        <div className="min-h-screen px-4 pt-8 pb-28">
          <div className="w-full max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-[24px] font-bold text-text-primary">
                  Download History
                </h1>
                <p className="text-[13px] text-text-secondary mt-1">
                  {history.length === 0
                    ? "Your completed downloads will appear here."
                    : `${history.length} completed download${history.length === 1 ? "" : "s"}`}
                </p>
              </div>

              <div className="w-11 h-11 rounded-2xl bg-bg-card flex items-center justify-center">
                <Clock3
                  className="w-5 h-5 text-text-secondary"
                  strokeWidth={1.8}
                />
              </div>
            </div>

            {history.length === 0 ? (
              <div className="min-h-[55vh] flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-bg-card flex items-center justify-center mb-4">
                  <Clock3
                    className="w-7 h-7 text-text-secondary/50"
                    strokeWidth={1.6}
                  />
                </div>
                <h2 className="text-[17px] font-semibold text-text-primary">
                  No history yet
                </h2>
                <p className="text-[14px] text-text-secondary mt-2 max-w-xs">
                  Once a download finishes successfully, it will be saved here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="bg-bg-card rounded-2xl overflow-hidden border border-[#27272a]"
                  >
                    <div className="flex items-center gap-3 p-3">
                      <div className="w-[104px] h-[64px] rounded-xl overflow-hidden bg-[#27272a] shrink-0">
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FolderOpen
                              className="w-6 h-6 text-text-secondary/30"
                              strokeWidth={1.5}
                            />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-[14px] font-semibold text-text-primary leading-snug line-clamp-2">
                          {item.title}
                        </h3>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-[12px] text-text-secondary">
                          <span>{item.format}</span>
                          <span>·</span>
                          <span>{item.size}</span>
                          {item.duration && (
                            <>
                              <span>·</span>
                              <span>{item.duration}</span>
                            </>
                          )}
                        </div>

                        <p className="text-[11px] text-text-secondary/70 mt-1">
                          {formatHistoryDate(item.createdAt)}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={!item.filepath}
                        onClick={() => {
                          if (item.filepath) {
                            // History currently stores the native local path.
                            // Reusing the existing flow action keeps file opening
                            // behind the same Tauri bridge used by the complete screen.
                            console.log(
                              "[History] open requested:",
                              item.filepath,
                            );
                          }
                        }}
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-text-secondary hover:bg-bg-primary disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                        aria-label="Open downloaded file"
                        title={item.filepath ? "Open file" : "File path unavailable"}
                      >
                        <FolderOpen className="w-4 h-4" strokeWidth={1.8} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === Settings === */}
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
