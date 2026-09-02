import { ArrowLeft } from "lucide-react";
import VideoPreviewCard from "../components/VideoPreviewCard";
import QualityOption from "../components/QualityOption";
import AudioOption from "../components/AudioOption";
import DownloadActionButton from "../components/DownloadActionButton";
import type { DownloadFormat, VideoInfo } from "../types/download";

interface DownloadSetupProps {
  videoInfo: VideoInfo;
  videoFormats: DownloadFormat[];
  audioFormats: DownloadFormat[];
  selectedFormat: DownloadFormat | null;
  onSelectFormat: (format: DownloadFormat) => void;
  onBack: () => void;
  onDownload: () => void;
}

const DownloadSetup = ({
  videoInfo,
  videoFormats,
  audioFormats,
  selectedFormat,
  onSelectFormat,
  onBack,
  onDownload,
}: DownloadSetupProps) => {
  const videoFormatsOnly = videoFormats.filter((f) => f.type === "video");
  const audioFormatsOnly = audioFormats.filter((f) => f.type === "audio");

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
          <VideoPreviewCard video={videoInfo} />

          {/* Video Quality Section */}
          <section>
            <h2 className="text-[12px] font-semibold text-text-secondary uppercase tracking-wider mb-3">
              Video Quality
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {videoFormatsOnly.map((format) => (
                <QualityOption
                  key={format.quality}
                  format={format}
                  isSelected={
                    selectedFormat?.type === "video" &&
                    selectedFormat.quality === format.quality
                  }
                  onSelect={onSelectFormat}
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
              {audioFormatsOnly.map((format) => (
                <AudioOption
                  key={format.quality}
                  format={format}
                  isSelected={
                    selectedFormat?.type === "audio" &&
                    selectedFormat.quality === format.quality
                  }
                  onSelect={onSelectFormat}
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
