const SkeletonCard = () => {
  return (
    <div className="w-full bg-bg-card rounded-2xl flex items-center px-4 h-[72px] gap-4">
      {/* Thumbnail placeholder */}
      <div className="w-[44px] h-[44px] rounded-lg bg-[#27272a] shrink-0 animate-pulse" />
      {/* Text lines placeholder */}
      <div className="flex-1 min-w-0 space-y-2.5">
        <div className="h-[12px] w-[70%] rounded-md bg-[#27272a] animate-pulse" />
        <div className="h-[12px] w-[45%] rounded-md bg-[#27272a] animate-pulse" />
      </div>
    </div>
  );
};

export default SkeletonCard;
