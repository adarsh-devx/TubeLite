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
}

export interface DownloadError {
  title: string;
  message: string;
}
