import { CircleCheck } from "lucide-react";
import type { VideoFormat } from "../types/download";

interface QualityOptionProps {
  format: VideoFormat;
  isSelected: boolean;
  onSelect: (format: VideoFormat) => void;
}

const QualityOption = ({ format, isSelected, onSelect }: QualityOptionProps) => {
  return (
    <button
      onClick={() => onSelect(format)}
      className={`relative w-full rounded-2xl p-4 text-left transition-colors ${
        isSelected
          ? "border border-accent bg-accent/5"
          : "border border-[#27272a] bg-bg-card"
      }`}
    >
      {/* Selection indicator */}
      {isSelected && (
        <CircleCheck className="absolute top-3 right-3 w-5 h-5 text-accent" strokeWidth={2} />
      )}

      {/* Quality label */}
      <span
        className={`text-lg font-bold ${
          isSelected ? "text-text-primary" : "text-text-primary"
        }`}
      >
        {format.quality}
      </span>

      {/* Format + size */}
      <p className="text-[13px] text-text-secondary mt-1">
        {format.label}
      </p>
    </button>
  );
};

export default QualityOption;
