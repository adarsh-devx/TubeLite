import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  AnalyzedResult,
  DownloadProgress,
  DownloadCompleteInfo,
  DownloadErrorInfo,
} from "../types/download";
import {
  analyzeWithBackend,
  downloadWithBackend,
  getDownloadStatus,
  getBackendUrl,
  type BackendDownloadStatus,
} from "./backend";

export interface RuntimeVersions {
  ytdlp: string | null;
  ffmpeg: string | null;
  ytdlpPath: string | null;
  ffmpegPath: string | null;
  isDevelopment: boolean;
}

/**
 * Typed wrapper around Tauri's invoke mechanism.
 * Provides a clean, type-safe way to call Rust commands from React.
 */
export async function invokeNative<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(command, args);
}

/**
 * Test command to verify React ↔ Rust communication.
 */
export async function ping(): Promise<string> {
  return invokeNative<string>("ping");
}

/**
 * Analyze a YouTube URL using yt-dlp.
 * On Android: routes to Kotlin yt-dlp-android plugin via Chaquopy.
 * On desktop: routes to Rust subprocess yt-dlp.
 */
export async function analyzeUrl(
  url: string,
  signal?: AbortSignal,
): Promise<AnalyzedResult> {
  if (isAndroidRuntime()) {
  console.log("[AndroidAnalyze] using backend analysis:", {
    url,
    backend: getBackendUrl(),
  });

  try {
    const result = await analyzeWithBackend(url, signal);

    console.log("[AndroidAnalyze] backend analysis success:", {
      title: result.title,
      videoFormats: result.video_formats.length,
      audioFormats: result.audio_formats.length,
    });

    return result;
  } catch (error) {
    console.error("[AndroidAnalyze] backend analysis FAILED:", error);
    throw error;
  }
}

  // Try Android bridge command first.
  // If the command itself is not available (desktop), fall back to analyze_url.
  // If the command IS available but returns an error (Android plugin failure),
  // propagate the actual error instead of falling back to the desktop path.
  try {
    return await invokeNative<AnalyzedResult>("android_extract_info", { url });
  } catch (err: unknown) {
    // Check if this is a "command not found" error (desktop) vs an actual plugin error (Android)
    const msg = typeof err === "object" && err !== null && "message" in err
      ? String((err as { message: unknown }).message)
      : String(err);

    // Tauri returns "Command android_extract_info not found" when the command doesn't exist (desktop)
    // On Android, the command exists but may fail with a plugin error
    if (msg.includes("not found") || msg.includes("NOT_ANDROID")) {
      // Desktop: use Rust subprocess yt-dlp
      return invokeNative<AnalyzedResult>("analyze_url", { url });
    }

    // Android: propagate the actual plugin error to the UI
    throw err;
  }
}

export function isAndroidRuntime(): boolean {
  return isTauriRuntime() && /Android/i.test(navigator.userAgent);
}

/**
 * Start a real download via yt-dlp (+ FFmpeg for MP3).
 */
export async function startDownload(
  url: string,
  quality: string,
  kind: "video" | "mp3" = "video",
): Promise<string> {
  const androidRuntime = isAndroidRuntime();
  console.log("[AndroidDownload] runtime check:", {
    isAndroidRuntime: androidRuntime,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "<unknown>",
    hasTauri: typeof window !== "undefined" && "__TAURI__" in window,
  });

  if (androidRuntime) {
    console.log("[AndroidDownload] selected Android backend-download branch");
    const backendResult = await downloadWithBackend(url, quality, kind);
    return backendResult.jobId;
  }

  return invokeNative<string>("start_download", {
    request: { url, quality, kind },
  });
}

export { getDownloadStatus };
export type { BackendDownloadStatus };

export async function downloadBackendFile(jobId: string, filename: string): Promise<string> {
  const args = { backendUrl: getBackendUrl(), jobId, filename };
  console.log("[AndroidDownload] file-transfer invocation:", args);
  try {
    const localPath = await invokeNative<string>("download_backend_file", args);
    console.log("[AndroidDownload] file-transfer result:", localPath);
    return localPath;
  } catch (error) {
    console.error("[AndroidDownload] file-transfer error:", error);
    throw error;
  }
}

export async function openLocalFile(path: string): Promise<void> {
  console.log("[AndroidDownload] openLocalFile invoking open_local_file native command with path:", path);
  try {
    const res = await invokeNative<void>("open_local_file", { path });
    console.log("[AndroidDownload] open_local_file native command returned successfully:", res);
    return res;
  } catch (error) {
    console.error("[AndroidDownload] open_local_file native command threw error:", error);
    throw error;
  }
}

export async function scanMediaFile(path: string): Promise<void> {
  try {
    await invokeNative<void>("scan_media", { path });
  } catch {
    // Best-effort — gallery visibility is not critical
  }
}

/**
 * Cancel the active download.
 */
export async function cancelDownload(): Promise<string> {
  return invokeNative<string>("cancel_download");
}

/**
 * Check if running inside Tauri runtime.
 */
export function isTauriRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

/**
 * Get runtime version information for yt-dlp and FFmpeg.
 * Developer-facing diagnostic tool.
 */
export async function getRuntimeVersions(): Promise<RuntimeVersions> {
  return invokeNative<RuntimeVersions>("get_runtime_versions");
}

// ── Event listeners ──────────────────────────────────────────────────

export function onDownloadProgress(
  callback: (payload: DownloadProgress) => void,
): Promise<UnlistenFn> {
  return listen<DownloadProgress>("download-progress", (event) => {
    callback(event.payload);
  });
}

export function onDownloadComplete(
  callback: (payload: DownloadCompleteInfo) => void,
): Promise<UnlistenFn> {
  return listen<DownloadCompleteInfo>("download-complete", (event) => {
    callback(event.payload);
  });
}

export function onDownloadError(
  callback: (payload: DownloadErrorInfo) => void,
): Promise<UnlistenFn> {
  return listen<DownloadErrorInfo>("download-error", (event) => {
    callback(event.payload);
  });
}
