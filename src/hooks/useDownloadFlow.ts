import { useState, useCallback, useEffect, useRef } from "react";
import type {
  VideoInfo,
  DownloadFormat,
  DownloadError,
  DownloadProgress,
  DownloadCompleteInfo,
  CompletedDownload,
} from "../types/download";
import {
  analyzeUrl,
  startDownload,
  cancelDownload,
  isTauriRuntime,
  isAndroidRuntime,
  onDownloadProgress,
  onDownloadComplete,
  onDownloadError,
  getDownloadStatus,
  downloadBackendFile,
  openLocalFile,
} from "../services/tauri";
import {
  MOCK_VIDEO_INFO,
  MOCK_VIDEO_FORMATS,
  MOCK_AUDIO_FORMATS,
  buildDownloadingInfo,
  buildCompletedDownload,
} from "../data/mockData";

export type Screen =
  | "home"
  | "analyzing"
  | "setup"
  | "downloading"
  | "complete"
  | "error"
  | "settings";

export type NavTab = "home" | "history" | "settings";

interface DownloadFlowState {
  screen: Screen;
  navTab: NavTab;
  url: string;
  videoInfo: VideoInfo | null;
  videoFormats: DownloadFormat[];
  audioFormats: DownloadFormat[];
  selectedFormat: DownloadFormat | null;
  progress: number;
  downloaded: string;
  speed: string;
  eta: string;
  error: DownloadError | null;
  stage?: "downloading" | "converting";
  downloadingInfoData?: {
    title: string;
    thumbnailUrl: string;
    format: string;
    quality: string;
    total: string;
  } | null;
  completedDownloadInfo?: CompletedDownload;
}

export function useDownloadFlow() {
  const [state, setState] = useState<DownloadFlowState>({
    screen: "home",
    navTab: "home",
    url: "",
    videoInfo: null,
    videoFormats: [],
    audioFormats: [],
    selectedFormat: null,
    progress: 0,
    downloaded: "0 MB",
    speed: "—",
    eta: "—",
    error: null,
  });

  const analyzeAbortRef = useRef<AbortController | null>(null);
  const eventUnlistenersRef = useRef<(() => void)[]>([]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (analyzeAbortRef.current) analyzeAbortRef.current.abort();
      eventUnlistenersRef.current.forEach((unlisten) => unlisten());
    };
  }, []);

  // ── Event listener management ──────────────────────────────────────

  const cleanupEventListeners = useCallback(() => {
    eventUnlistenersRef.current.forEach((unlisten) => unlisten());
    eventUnlistenersRef.current = [];
  }, []);

  const setupDownloadEventListeners = useCallback(() => {
    cleanupEventListeners();

    const unlistenProgress = onDownloadProgress((payload: DownloadProgress) => {
      setState((s) => ({
        ...s,
        progress: payload.progress,
        downloaded: payload.downloaded || s.downloaded,
        total: payload.total || s.downloaded,
        speed: payload.speed,
        eta: payload.eta,
        stage: payload.stage ?? s.stage,
      }));
    });

    const unlistenComplete = onDownloadComplete(
      (payload: DownloadCompleteInfo) => {
        cleanupEventListeners();
        setState((s) => ({
          ...s,
          screen: "complete",
          progress: 100,
          completedDownloadInfo: {
            title: payload.title,
            type: payload.format.toLowerCase() === "mp3" ? "audio" : "video",
            filename: payload.filename,
            filepath: payload.filepath,
            format: payload.format,
            size: payload.size,
            duration: payload.duration,
            thumbnail: payload.thumbnail,
          },
        }));
      },
    );

    const unlistenError = onDownloadError((payload) => {
      cleanupEventListeners();
      setState((s) => ({
        ...s,
        screen: "error",
        error: {
          title: "Download failed",
          message: payload.message,
        },
      }));
    });

    Promise.all([unlistenProgress, unlistenComplete, unlistenError]).then(
      (fns) => {
        eventUnlistenersRef.current = fns;
      },
    );
  }, [cleanupEventListeners]);

  // ── Analyze ───────────────────────────────────────────────────────

  const performAnalyze = useCallback(async (url: string) => {
    if (analyzeAbortRef.current) {
      analyzeAbortRef.current.abort();
    }
    const controller = new AbortController();
    analyzeAbortRef.current = controller;

    // Browser-only fallback: mock data
    if (!isTauriRuntime()) {
      await new Promise((r) => setTimeout(r, 2000));
      if (controller.signal.aborted) return;
      setState((s) => ({
        ...s,
        videoInfo: MOCK_VIDEO_INFO,
        videoFormats: MOCK_VIDEO_FORMATS,
        audioFormats: MOCK_AUDIO_FORMATS,
        screen: "setup",
      }));
      return;
    }

    try {
      const result = await analyzeUrl(url, controller.signal);
      if (controller.signal.aborted) return;

      const {
        mapAnalyzedToVideoInfo,
        mapAnalyzedToVideoFormats,
        mapAnalyzedToAudioFormats,
      } = await import("../types/download");

      setState((s) => ({
        ...s,
        videoInfo: mapAnalyzedToVideoInfo(result),
        videoFormats: mapAnalyzedToVideoFormats(result),
        audioFormats: mapAnalyzedToAudioFormats(result),
        screen: "setup",
      }));
    } catch (err: unknown) {
      if (controller.signal.aborted) return;

      let error: DownloadError;
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        "message" in err
      ) {
        const e = err as { code: string; message: string };
        error = {
          title: "Couldn't analyze this video",
          message: e.message,
        };
      } else {
        error = {
          title: "Couldn't analyze this video",
          message:
            "Something went wrong while processing the YouTube link. Please check your connection or the link itself.",
        };
      }

      setState((s) => ({ ...s, screen: "error", error }));
    }
  }, []);

  // ── Core Flow ─────────────────────────────────────────────────────

  const handleAnalyze = useCallback(
    (url: string) => {
      setState((s) => ({
        ...s,
        url,
        screen: "analyzing",
        navTab: "home",
        error: null,
      }));
      performAnalyze(url);
    },
    [performAnalyze],
  );

  const handleSelectFormat = useCallback((format: DownloadFormat) => {
    setState((s) => {
      const prev = s.selectedFormat;
      if (
        prev &&
        prev.type === format.type &&
        prev.quality === format.quality
      ) {
        return { ...s, selectedFormat: null };
      }
      return { ...s, selectedFormat: format };
    });
  }, []);

  const handleStartDownload = useCallback(async () => {
    const { url, selectedFormat, videoInfo } = state;
    if (!selectedFormat) return;

    // Build downloading info from current data
    const info = videoInfo
      ? buildDownloadingInfo(videoInfo, selectedFormat)
      : {
          title: "Downloading...",
          thumbnailUrl: "",
          format: selectedFormat.type === "video" ? selectedFormat.format : "MP3",
          quality: selectedFormat.quality,
          progress: 0,
          downloaded: "0 MB",
          total: selectedFormat.size,
          speed: "—",
          eta: "—",
        };

    setState((s) => ({
      ...s,
      screen: "downloading",
      progress: 0,
      downloaded: "0 MB",
      speed: "—",
      eta: "—",
      stage: "downloading",
      downloadingInfoData: info,
    }));

    // In browser-only mode, use mock progress simulation
    if (!isTauriRuntime()) {
      const MOCK_STEPS = [
        { progress: 5, downloaded: "4 MB", speed: "2.1 MB/s", eta: "01:18" },
        { progress: 15, downloaded: "13 MB", speed: "3.2 MB/s", eta: "00:56" },
        { progress: 28, downloaded: "24 MB", speed: "3.8 MB/s", eta: "00:42" },
        { progress: 42, downloaded: "36 MB", speed: "4.1 MB/s", eta: "00:31" },
        { progress: 58, downloaded: "49 MB", speed: "3.9 MB/s", eta: "00:21" },
        { progress: 73, downloaded: "62 MB", speed: "3.5 MB/s", eta: "00:12" },
        { progress: 88, downloaded: "75 MB", speed: "3.2 MB/s", eta: "00:05" },
        { progress: 96, downloaded: "82 MB", speed: "2.8 MB/s", eta: "00:02" },
        { progress: 100, downloaded: "85 MB", speed: "—", eta: "00:00" },
      ];
      let idx = 0;
      const timer = setInterval(() => {
        if (idx >= MOCK_STEPS.length) {
          clearInterval(timer);
          setState((s) => ({ ...s, screen: "complete" }));
          return;
        }
        const step = MOCK_STEPS[idx];
        setState((s) => ({
          ...s,
          progress: step.progress,
          downloaded: step.downloaded,
          speed: step.speed,
          eta: step.eta,
        }));
        idx++;
      }, 2000);
      return;
    }

    // Wire up real Tauri event listeners before starting
    setupDownloadEventListeners();

    // Start real download via Rust
    const kind = selectedFormat.type === "audio" ? "mp3" : "video";
    try {
      const jobId = await startDownload(url, selectedFormat.quality, kind);
      if (isAndroidRuntime()) {
        for (;;) {
          const status = await getDownloadStatus(jobId);
          setState((s) => ({
            ...s,
            progress: status.progress,
            downloaded: status.downloaded,
            speed: status.speed,
            eta: status.eta,
            stage: "downloading",
          }));

          if (status.status === "completed" && status.result) {
            console.log("[AndroidDownload] status branch: completed", status);
            const localPath = await downloadBackendFile(jobId, status.result.filename);
            cleanupEventListeners();
            setState((s) => ({
              ...s,
              screen: "complete",
              progress: 100,
              completedDownloadInfo: {
                title: status.result!.title,
                type: kind === "mp3" ? "audio" : "video",
                format: status.result!.format,
                size: status.result!.size,
                duration: status.result!.duration,
                thumbnailUrl: status.result!.thumbnail,
                filepath: localPath,
              },
            }));
            break;
          }

          if (status.status === "failed") {
            console.error("[AndroidDownload] status branch: failed", status);
            throw new Error(status.error || "Download failed");
          }

          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    } catch (err: unknown) {
      cleanupEventListeners();
      console.error("[AndroidDownload] exact exception reaching useDownloadFlow:", err);
      let error: DownloadError;
      if (err instanceof Error) {
        error = { title: "Couldn't start download", message: err.message };
      } else if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        "message" in err
      ) {
        const e = err as { code: string; message: string };
        error = { title: "Couldn't start download", message: e.message };
      } else {
        error = {
          title: "Download failed",
          message: "Could not start the download. Please try again.",
        };
      }
      console.error("[AndroidDownload] surfaced error to UI:", error);
      setState((s) => ({ ...s, screen: "error", error }));
    }
  }, [state, setupDownloadEventListeners, cleanupEventListeners]);

  const handleCancelDownload = useCallback(async () => {
    cleanupEventListeners();

    if (isTauriRuntime()) {
      try {
        await cancelDownload();
      } catch {
        // Cancel best-effort — return to setup regardless
      }
    }

    setState((s) => ({
      ...s,
      screen: "setup",
      selectedFormat: null,
      progress: 0,
      downloaded: "0 MB",
      speed: "—",
      eta: "—",
      stage: undefined,
    }));
  }, [cleanupEventListeners]);

  const handleOpenFile = useCallback(() => {
    console.log("[AndroidDownload] handleOpenFile invoked", {
      isAndroid: isAndroidRuntime(),
      filepath: state.completedDownloadInfo?.filepath,
    });
    if (isAndroidRuntime() && state.completedDownloadInfo?.filepath) {
      console.log("[AndroidDownload] handleOpenFile calling openLocalFile with path:", state.completedDownloadInfo.filepath);
      void openLocalFile(state.completedDownloadInfo.filepath)
        .then(() => {
          console.log("[AndroidDownload] openLocalFile promise resolved successfully");
        })
        .catch((error) => {
          console.error("[AndroidDownload] openLocalFile promise rejected with error:", error);
        });
    } else {
      console.warn("[AndroidDownload] handleOpenFile failed guard check:", {
        isAndroid: isAndroidRuntime(),
        filepath: state.completedDownloadInfo?.filepath,
      });
    }
  }, [state.completedDownloadInfo]);

  const handleDownloadAnother = useCallback(() => {
    cleanupEventListeners();
    setState((s) => ({
      ...s,
      screen: "home",
      navTab: "home",
      url: "",
      videoInfo: null,
      videoFormats: [],
      audioFormats: [],
      selectedFormat: null,
      progress: 0,
      downloaded: "0 MB",
      speed: "—",
      eta: "—",
      error: null,
    }));
  }, [cleanupEventListeners]);

  const handleTryAgain = useCallback(() => {
    cleanupEventListeners();
    const url = state.url;
    setState((s) => ({
      ...s,
      screen: "analyzing",
      error: null,
      progress: 0,
      downloaded: "0 MB",
      speed: "—",
      eta: "—",
    }));
    performAnalyze(url);
  }, [cleanupEventListeners, performAnalyze, state.url]);

  const handleChangeLink = useCallback(() => {
    cleanupEventListeners();
    if (analyzeAbortRef.current) {
      analyzeAbortRef.current.abort();
    }
    setState((s) => ({
      ...s,
      screen: "home",
      navTab: "home",
      url: "",
      videoInfo: null,
      videoFormats: [],
      audioFormats: [],
      selectedFormat: null,
      progress: 0,
      downloaded: "0 MB",
      speed: "—",
      eta: "—",
      error: null,
    }));
  }, [cleanupEventListeners]);

  const handleBackToHome = useCallback(() => {
    if (analyzeAbortRef.current) {
      analyzeAbortRef.current.abort();
    }
    setState((s) => ({
      ...s,
      screen: "home",
      navTab: "home",
      url: "",
      videoInfo: null,
      videoFormats: [],
      audioFormats: [],
      selectedFormat: null,
      error: null,
    }));
  }, []);

  const handleBackToAnalyzing = useCallback(() => {
    setState((s) => ({ ...s, screen: "analyzing" }));
  }, []);

  const handleBackToSetup = useCallback(() => {
    setState((s) => ({ ...s, screen: "setup" }));
  }, []);

  const handleAnalysisComplete = useCallback(() => {
    setState((s) => ({ ...s, screen: "setup" }));
  }, []);

  const handleNavChange = useCallback((tab: NavTab) => {
    setState((s) => {
      if (tab === "settings") {
        return { ...s, navTab: "settings", screen: "settings" };
      }
      if (tab === "history") {
        return { ...s, navTab: "history", screen: "home" };
      }
      return {
        ...s,
        navTab: "home",
        screen: s.screen === "settings" ? "home" : s.screen,
      };
    });
  }, []);

  const handleSettingsBack = useCallback(() => {
    setState((s) => ({ ...s, navTab: "home", screen: "home" }));
  }, []);

  // Compute derived state
  const videoInfo = state.videoInfo ?? MOCK_VIDEO_INFO;
  const videoFormats =
    state.videoFormats.length > 0 ? state.videoFormats : MOCK_VIDEO_FORMATS;
  const audioFormats =
    state.audioFormats.length > 0 ? state.audioFormats : MOCK_AUDIO_FORMATS;

  const downloadingInfo =
    state.selectedFormat && state.screen === "downloading"
      ? {
          ...(state.downloadingInfoData ??
            buildDownloadingInfo(videoInfo, state.selectedFormat)),
          progress: state.progress,
          downloaded: state.downloaded,
          speed: state.speed,
          eta: state.eta,
        }
      : null;

  const completedDownload =
    state.screen === "complete"
      ? state.completedDownloadInfo ??
        (state.selectedFormat
          ? buildCompletedDownload(videoInfo, state.selectedFormat)
          : null)
      : null;

  return {
    // State
    screen: state.screen,
    navTab: state.navTab,
    url: state.url,
    videoInfo,
    videoFormats,
    audioFormats,
    selectedFormat: state.selectedFormat,
    downloadingInfo,
    completedDownload,
    error: state.error,
    stage: state.stage,

    // Actions
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
  };
}
