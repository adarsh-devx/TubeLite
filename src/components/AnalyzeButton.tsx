interface AnalyzeButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

const AnalyzeButton = ({ onPress, disabled = false }: AnalyzeButtonProps) => {
  return (
    <button
      onClick={onPress}
      disabled={disabled}
      className="w-full h-[54px] rounded-2xl bg-accent text-white font-bold text-[15px] tracking-wide uppercase flex items-center justify-center active:scale-[0.98] transition-transform disabled:opacity-50 disabled:active:scale-100"
    >
      Analyze Link
    </button>
  );
};

export default AnalyzeButton;
