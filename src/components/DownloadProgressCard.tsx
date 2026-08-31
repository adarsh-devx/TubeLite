import { Gauge, Timer } from "lucide-react";

interface DownloadProgressCardProps {
  progress: number;
  downloaded: string;
  total: string;
  speed: string;
  eta: string;
}

const DownloadProgressCard = ({
  progress,
  downloaded,
  total,
  speed,
  eta,
}: DownloadProgressCardProps) => {
  return (
    <div className="w-full bg-bg-card rounded-2xl p-6 space-y-5">
      {/* Percentage */}
      <p className="text-[48px] font-bold text-accent text-center leading-none">
        {progress}%
      </p>

      {/* Downloaded / Total */}
      <p className="text-[15px] text-text-secondary text-center">
        {downloaded} / {total}
      </p>

      {/* Progress bar */}
      <div className="w-full h-[8px] bg-[#27272a] rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-300"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      {/* Speed + ETA */}
      <div className="grid grid-cols-2 gap-3">
        {/* Speed */}
        <div className="flex flex-col items-center gap-1.5 py-3 bg-bg-primary rounded-xl border border-[#27272a]">
          <Gauge className="w-4 h-4 text-text-secondary" strokeWidth={2} />
          <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
            Speed
          </span>
          <span className="text-[15px] font-bold text-text-primary">
            {speed}
          </span>
        </div>

        {/* ETA */}
        <div className="flex flex-col items-center gap-1.5 py-3 bg-bg-primary rounded-xl border border-[#27272a]">
          <Timer className="w-4 h-4 text-text-secondary" strokeWidth={2} />
          <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
            ETA
          </span>
          <span className="text-[15px] font-bold text-text-primary">
            {eta}
          </span>
        </div>
      </div>
    </div>
  );
};

export default DownloadProgressCard;
