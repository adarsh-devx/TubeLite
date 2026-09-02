export type VideoFormat = {
  type: "video";
  quality: string;
  label: string;
  format: string;
  size: string;
};

export type AudioFormat = {
  type: "audio";
  quality: string;
  label: string;
  bitrate: string;
  size: string;
};

export type DownloadFormat = VideoFormat | AudioFormat;

export interface VideoInfo {
  title: string;
  channel: string;
  duration: string;
  thumbnailUrl: string;
}

export interface DownloadingInfo {
  title: string;
  thumbnailUrl: string;
  format: string;
  quality: string;
  progress: number;
  downloaded: string;
  total: string;
  speed: string;
  eta: string;
}

export interface CompletedDownload {
  title: string;
  type: "video" | "audio";
  format: string;
  size: string;
  duration?: string;
  thumbnailUrl?: string;
  filepath?: string;
}

export interface DownloadError {
  title: string;
  message: string;
}

// ── Tauri event payloads (matches Rust structs) ──────────────────────

export interface DownloadProgress {
  progress: number;
  downloaded: string;
  total: string;
  speed: string;
  eta: string;
  stage?: "downloading" | "converting";
}

export interface DownloadCompleteInfo {
  title: string;
  filename: string;
  filepath: string;
  format: string;
  size: string;
  duration: string;
  thumbnail: string;
}

export interface DownloadErrorInfo {
  code: string;
  message: string;
}

// ── Analyze command types (matches Rust AnalyzedVideo) ──────────────

export interface AnalyzedVideoFormat {
  quality: string;
  label: string;
  format: string;
  size: string;
}

export interface AnalyzedAudioFormat {
  quality: string;
  label: string;
  bitrate: string;
  size: string;
}

export interface AnalyzedResult {
  title: string;
  channel: string;
  duration: string;
  thumbnail: string;
  video_formats: AnalyzedVideoFormat[];
  audio_formats: AnalyzedAudioFormat[];
}

/** Map Rust AnalyzedResult to the VideoInfo + DownloadFormat[] used by the UI */
export function mapAnalyzedToVideoInfo(result: AnalyzedResult): VideoInfo {
  return {
    title: result.title,
    channel: result.channel,
    duration: result.duration,
    thumbnailUrl: result.thumbnail,
  };
}

export function mapAnalyzedToVideoFormats(
  result: AnalyzedResult,
): VideoFormat[] {
  return result.video_formats.map((f) => ({
    type: "video" as const,
    quality: f.quality,
    label: f.label,
    format: f.format,
    size: f.size,
  }));
}

export function mapAnalyzedToAudioFormats(
  result: AnalyzedResult,
): AudioFormat[] {
  return result.audio_formats.map((f) => ({
    type: "audio" as const,
    quality: f.quality,
    label: f.label,
    bitrate: f.bitrate,
    size: f.size,
  }));
}
