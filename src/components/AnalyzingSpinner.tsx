const AnalyzingSpinner = () => {
  return (
    <div className="relative w-[56px] h-[56px]">
      {/* Spinning red ring */}
      <div className="absolute inset-0 rounded-full border-[3px] border-accent border-t-transparent animate-spin" />
      {/* Subtle glow behind */}
      <div className="absolute inset-0 rounded-full bg-accent/10 blur-xl" />
    </div>
  );
};

export default AnalyzingSpinner;
