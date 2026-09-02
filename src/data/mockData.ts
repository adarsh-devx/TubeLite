import type {
  VideoInfo,
  DownloadFormat,
  DownloadingInfo,
  CompletedDownload,
  DownloadError,
} from "../types/download";

export const MOCK_VIDEO_INFO: VideoInfo = {
  title: "Neon Nights: Urban Explorations Through City Lights",
  channel: "Cinematic Vlogs",
  duration: "12:48",
  thumbnailUrl: "",
};

export const MOCK_VIDEO_FORMATS: DownloadFormat[] = [
  { type: "video", quality: "1080p", label: "HD · 85MB", format: "MP4", size: "85 MB" },
  { type: "video", quality: "720p", label: "SD · 42MB", format: "MP4", size: "42 MB" },
  { type: "video", quality: "480p", label: "Low · 24MB", format: "MP4", size: "24 MB" },
  { type: "video", quality: "360p", label: "Data Saver · 14MB", format: "MP4", size: "14 MB" },
];

export const MOCK_AUDIO_FORMATS: DownloadFormat[] = [
  {
    type: "audio",
    quality: "MP3 320kbps",
    label: "High Quality",
    bitrate: "320 kbps",
    size: "9.8 MB",
  },
];

export const MOCK_COMPLETED_DOWNLOAD: CompletedDownload = {
  title: "Neon Nights: Urban Explorations Through City Lights",
  type: "video",
  format: "MP4",
  size: "85 MB",
  duration: "12:48",
  thumbnailUrl: "",
};

export const MOCK_ERROR: DownloadError = {
  title: "Couldn't download this video",
  message:
    "Something went wrong while processing the YouTube link. Please check your connection or the link itself.",
};

/** Build a DownloadingInfo from the video info + selected format */
export function buildDownloadingInfo(
  video: VideoInfo,
  format: DownloadFormat,
): DownloadingInfo {
  const size = format.type === "video" ? format.size : format.size;
  return {
    title: video.title,
    thumbnailUrl: video.thumbnailUrl,
    format: format.type === "video" ? format.format : "MP3",
    quality: format.quality,
    progress: 0,
    downloaded: "0 MB",
    total: size,
    speed: "—",
    eta: "—",
  };
}

/** Build CompletedDownload from video info + selected format */
export function buildCompletedDownload(
  video: VideoInfo,
  format: DownloadFormat,
): CompletedDownload {
  return {
    title: video.title,
    type: format.type,
    format: format.type === "video" ? format.format : "MP3",
    size: format.type === "video" ? format.size : format.size,
    duration: video.duration,
    thumbnailUrl: video.thumbnailUrl,
  };
}
