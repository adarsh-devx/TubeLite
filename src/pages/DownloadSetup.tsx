import { useState, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import VideoPreviewCard from "../components/VideoPreviewCard";
import QualityOption from "../components/QualityOption";
import AudioOption from "../components/AudioOption";
import DownloadActionButton from "../components/DownloadActionButton";
import type { DownloadFormat, VideoInfo } from "../types/download";

interface DownloadSetupProps {
  onBack: () => void;
  onDownload: () => void;
}

const MOCK_VIDEO: VideoInfo = {
  title: "Neon Nights: Urban Explorations Through City Lights",
  channel: "Cinematic Vlogs",
  duration: "12:48",
  thumbnailUrl: "",
};

const MOCK_VIDEO_FORMATS: DownloadFormat[] = [
  { type: "video", quality: "1080p", label: "HD · 85MB", format: "MP4", size: "85 MB" },
  { type: "video", quality: "720p", label: "SD · 42MB", format: "MP4", size: "42 MB" },
  { type: "video", quality: "480p", label: "Low · 24MB", format: "MP4", size: "24 MB" },
  { type: "video", quality: "360p", label: "Data Saver · 14MB", format: "MP4", size: "14 MB" },
];

const MOCK_AUDIO_FORMATS: DownloadFormat[] = [
  { type: "audio", quality: "MP3 320kbps", label: "High Quality", bitrate: "320 kbps", size: "9.8 MB" },
];

const DownloadSetup = ({ onBack, onDownload }: DownloadSetupProps) => {
  const [selectedFormat, setSelectedFormat] = useState<DownloadFormat | null>(null);

  const handleSelect = useCallback((format: DownloadFormat) => {
    setSelectedFormat((prev) => {
      // If clicking the already-selected format, deselect it
      if (
        prev &&
        prev.type === format.type &&
        prev.quality === format.quality
      ) {
        return null;
      }
      return format;
    });
  }, []);

  const videoFormats = MOCK_VIDEO_FORMATS.filter((f) => f.type === "video");
  const audioFormats = MOCK_AUDIO_FORMATS.filter((f) => f.type === "audio");

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Top bar */}
      <header className="w-full flex items-center px-4 pt-5 pb-3 gap-3">
        <button
          onClick={onBack}
          className="p-1 -ml-1 shrink-0"
          aria-label="Go back"
        >
          <ArrowLeft className="w-6 h-6 text-text-primary" strokeWidth={2} />
        </button>
        <h1 className="text-[20px] font-bold text-text-primary flex-1 text-center -mr-8">
          Download Setup
        </h1>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-md mx-auto px-4 space-y-6 pb-20">
          {/* Video preview */}
          <VideoPreviewCard video={MOCK_VIDEO} />

          {/* Video Quality Section */}
          <section>
            <h2 className="text-[12px] font-semibold text-text-secondary uppercase tracking-wider mb-3">
              Video Quality
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {videoFormats.map((format) => (
                <QualityOption
                  key={format.quality}
                  format={format}
                  isSelected={
                    selectedFormat?.type === "video" &&
                    selectedFormat.quality === format.quality
                  }
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </section>

          {/* Audio Only Section */}
          <section>
            <h2 className="text-[12px] font-semibold text-text-secondary uppercase tracking-wider mb-3">
              Audio Only
            </h2>
            <div className="space-y-3">
              {audioFormats.map((format) => (
                <AudioOption
                  key={format.quality}
                  format={format}
                  isSelected={
                    selectedFormat?.type === "audio" &&
                    selectedFormat.quality === format.quality
                  }
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </section>

          {/* Download button */}
          <DownloadActionButton
            disabled={!selectedFormat}
            onPress={onDownload}
          />
        </div>
      </div>
    </div>
  );
};

export default DownloadSetup;
