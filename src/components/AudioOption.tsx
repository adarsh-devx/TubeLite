import { Music2, CircleCheck } from "lucide-react";
import type { AudioFormat } from "../types/download";

interface AudioOptionProps {
  format: AudioFormat;
  isSelected: boolean;
  onSelect: (format: AudioFormat) => void;
}

const AudioOption = ({ format, isSelected, onSelect }: AudioOptionProps) => {
  return (
    <button
      onClick={() => onSelect(format)}
      className={`w-full rounded-2xl flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
        isSelected
          ? "border border-accent bg-accent/5"
          : "border border-[#27272a] bg-bg-card"
      }`}
    >
      {/* Music icon */}
      <Music2
        className={`w-5 h-5 shrink-0 ${
          isSelected ? "text-accent" : "text-text-secondary"
        }`}
        strokeWidth={2}
      />

      {/* Text content */}
      <div className="flex-1 min-w-0">
        <span className="text-[15px] font-semibold text-text-primary">
          {format.quality}
        </span>
        <p className="text-[13px] text-text-secondary mt-0.5">
          {format.label}
        </p>
      </div>

      {/* Size */}
      <span className="text-[13px] text-text-secondary shrink-0">
        {format.size}
      </span>

      {/* Selection indicator */}
      {isSelected && (
        <CircleCheck className="w-5 h-5 text-accent shrink-0" strokeWidth={2} />
      )}
    </button>
  );
};

export default AudioOption;
