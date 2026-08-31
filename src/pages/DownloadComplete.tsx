import { CircleCheck, FolderOpen, Download } from "lucide-react";
import type { CompletedDownload } from "../types/download";

interface DownloadCompleteProps {
  file: CompletedDownload;
  onOpenFile: () => void;
  onDownloadAnother: () => void;
}

const DownloadComplete = ({
  file,
  onOpenFile,
  onDownloadAnother,
}: DownloadCompleteProps) => {
  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Success indicator */}
      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="w-[72px] h-[72px] rounded-full bg-emerald-500/15 flex items-center justify-center">
          <CircleCheck
            className="w-10 h-10 text-emerald-500"
            strokeWidth={2}
          />
        </div>
        <h1 className="text-[22px] font-bold text-text-primary text-center">
          Download complete
        </h1>
      </div>

      {/* File card */}
      <div className="w-full max-w-md bg-bg-card rounded-2xl overflow-hidden mb-8">
        <div className="flex items-stretch">
          {/* Thumbnail */}
          <div className="w-[120px] sm:w-[140px] aspect-video bg-[#27272a] shrink-0">
            {file.thumbnailUrl ? (
              <img
                src={file.thumbnailUrl}
                alt={file.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <FolderOpen className="w-8 h-8 text-text-secondary/30" strokeWidth={1.5} />
              </div>
            )}
          </div>

          {/* File info */}
          <div className="flex-1 min-w-0 p-4 flex flex-col justify-center">
            <h3 className="text-[15px] font-semibold text-text-primary leading-snug line-clamp-2">
              {file.title}
            </h3>
            <div className="flex items-center gap-2 mt-2 text-[13px] text-text-secondary">
              <span>{file.format}</span>
              <span>·</span>
              <span>{file.size}</span>
              {file.duration && (
                <>
                  <span>·</span>
                  <span>{file.duration}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="w-full max-w-md space-y-3">
        {/* Open File — primary */}
        <button
          onClick={onOpenFile}
          className="w-full h-[54px] rounded-2xl bg-accent text-white font-bold text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <FolderOpen className="w-5 h-5" strokeWidth={2} />
          Open File
        </button>

        {/* Download Another — secondary */}
        <button
          onClick={onDownloadAnother}
          className="w-full h-[54px] rounded-2xl border border-[#27272a] bg-transparent text-text-secondary font-bold text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] transition-colors hover:bg-bg-card"
        >
          <Download className="w-5 h-5" strokeWidth={2} />
          Download Another
        </button>
      </div>
    </div>
  );
};

export default DownloadComplete;
