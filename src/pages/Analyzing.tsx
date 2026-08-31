import { useEffect } from "react";
import { Link } from "lucide-react";
import AppHeader from "../components/AppHeader";
import AnalyzingSpinner from "../components/AnalyzingSpinner";
import SkeletonCard from "../components/SkeletonCard";

interface AnalyzingProps {
  url: string;
  onBack: () => void;
  onComplete: () => void;
}

const Analyzing = ({ url, onBack: _onBack, onComplete }: AnalyzingProps) => {
  // Simulate analysis completion after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="w-full min-h-screen flex flex-col pb-24">
      {/* App header / branding */}
      <AppHeader />

      {/* URL card */}
      <div className="w-full max-w-md mx-auto px-4 pt-3">
        <div className="w-full bg-bg-card rounded-2xl flex items-center px-4 h-[52px] min-w-0">
          <Link
            className="w-5 h-5 text-text-secondary shrink-0"
            strokeWidth={2}
          />
          <span className="flex-1 min-w-0 text-[15px] text-text-secondary ml-3 truncate">
            {url}
          </span>
        </div>
      </div>

      {/* Centered loading state */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <AnalyzingSpinner />
        <h2 className="text-xl sm:text-2xl font-bold text-text-primary text-center mt-6">
          Analyzing video...
        </h2>
        <p className="text-sm text-text-secondary text-center mt-2">
          Fetching available formats and resolutions
        </p>
      </div>

      {/* Skeleton loading cards */}
      <div className="w-full max-w-md mx-auto space-y-3 px-4 pb-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
};

export default Analyzing;
