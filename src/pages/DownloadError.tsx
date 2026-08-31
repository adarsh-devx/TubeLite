import { Download, Settings, CircleAlert, RotateCcw, Link } from "lucide-react";
import type { DownloadError as DownloadErrorType } from "../types/download";

interface DownloadErrorProps {
  error: DownloadErrorType;
  onTryAgain: () => void;
  onChangeLink: () => void;
}

const DownloadErrorScreen = ({
  error,
  onTryAgain,
  onChangeLink,
}: DownloadErrorProps) => {
  return (
    <div className="w-full min-h-screen flex flex-col">
      {/* Header */}
      <header className="w-full flex items-center justify-between px-4 pt-5 pb-4">
        <Download className="w-5 h-5 text-text-secondary" strokeWidth={2} />
        <h1 className="text-[18px] font-bold text-text-primary">
          TubeLite Downloader
        </h1>
        <Settings className="w-5 h-5 text-text-secondary" strokeWidth={2} />
      </header>

      {/* Error card — centered */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md bg-bg-card rounded-2xl p-8 flex flex-col items-center text-center">
          {/* Error indicator */}
          <div className="w-[64px] h-[64px] rounded-full bg-accent/15 flex items-center justify-center mb-5">
            <CircleAlert
              className="w-8 h-8 text-accent"
              strokeWidth={2}
            />
          </div>

          {/* Error title */}
          <h2 className="text-[20px] font-bold text-text-primary leading-snug">
            {error.title}
          </h2>

          {/* Error message */}
          <p className="text-[14px] text-text-secondary leading-relaxed mt-3 max-w-[280px]">
            {error.message}
          </p>

          {/* Actions */}
          <div className="w-full space-y-3 mt-8">
            {/* Try Again — primary */}
            <button
              onClick={onTryAgain}
              className="w-full h-[54px] rounded-2xl bg-accent text-white font-bold text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <RotateCcw className="w-5 h-5" strokeWidth={2} />
              Try Again
            </button>

            {/* Change Link — secondary */}
            <button
              onClick={onChangeLink}
              className="w-full h-[54px] rounded-2xl border border-[#27272a] bg-transparent text-text-secondary font-bold text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] transition-colors hover:bg-bg-primary"
            >
              <Link className="w-5 h-5" strokeWidth={2} />
              Change Link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DownloadErrorScreen;
