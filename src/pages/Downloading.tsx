import { ArrowLeft } from "lucide-react";
import DownloadProgressCard from "../components/DownloadProgressCard";
import CancelDownloadButton from "../components/CancelDownloadButton";
import type { DownloadingInfo } from "../types/download";

interface DownloadingProps {
  info: DownloadingInfo;
  onBack: () => void;
  onCancel: () => void;
  onComplete: () => void;
}

const Downloading = ({ info, onBack, onCancel: _onCancel, onComplete }: DownloadingProps) => {
  return (
    <div className="w-full min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="w-full relative flex items-center px-4 pt-5 pb-3">
        <button
          onClick={onBack}
          className="p-1 shrink-0 relative z-10"
          aria-label="Go back"
        >
          <ArrowLeft className="w-6 h-6 text-text-primary" strokeWidth={2} />
        </button>
        <h1 className="text-[20px] font-bold text-text-primary absolute left-0 right-0 text-center pointer-events-none">
          Downloading
        </h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-md mx-auto px-4 space-y-5 pb-8">
          {/* Video info card */}
          <div className="w-full bg-bg-card rounded-2xl flex items-center p-3 gap-3 min-w-0">
            {/* Thumbnail */}
            <div className="relative w-[100px] aspect-video rounded-xl overflow-hidden shrink-0 bg-[#27272a]">
              {info.thumbnailUrl ? (
                <img
                  src={info.thumbnailUrl}
                  alt={info.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-text-secondary/40 text-[11px] font-medium">
                  TL
                </div>
              )}
            </div>

            {/* Video info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-[15px] font-semibold text-text-primary leading-snug truncate">
                {info.title}
              </h3>
              <p className="text-[13px] text-text-secondary mt-1 truncate">
                {info.format} · {info.quality}
              </p>
            </div>
          </div>

          {/* Progress card */}
          <DownloadProgressCard
            progress={info.progress}
            downloaded={info.downloaded}
            total={info.total}
            speed={info.speed}
            eta={info.eta}
          />
        </div>
      </div>

      {/* Cancel button — at bottom above safe area */}
      <div className="w-full max-w-md mx-auto px-4 pb-6">
        <CancelDownloadButton onPress={onComplete} />
      </div>
    </div>
  );
};

export default Downloading;
