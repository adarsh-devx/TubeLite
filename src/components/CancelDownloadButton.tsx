import { X } from "lucide-react";

interface CancelDownloadButtonProps {
  onPress: () => void;
}

const CancelDownloadButton = ({ onPress }: CancelDownloadButtonProps) => {
  return (
    <button
      onClick={onPress}
      className="w-full h-[54px] rounded-2xl border border-accent bg-transparent text-accent font-bold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
    >
      <X className="w-5 h-5" strokeWidth={2.5} />
      Cancel Download
    </button>
  );
};

export default CancelDownloadButton;
