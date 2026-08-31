import { Download } from "lucide-react";

interface DownloadActionButtonProps {
  disabled?: boolean;
  onPress: () => void;
}

const DownloadActionButton = ({
  disabled = false,
  onPress,
}: DownloadActionButtonProps) => {
  return (
    <button
      onClick={onPress}
      disabled={disabled}
      className="w-full h-[54px] rounded-2xl bg-accent text-white font-bold text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40 disabled:active:scale-100"
    >
      <Download className="w-5 h-5" strokeWidth={2.5} />
      Download
    </button>
  );
};

export default DownloadActionButton;
