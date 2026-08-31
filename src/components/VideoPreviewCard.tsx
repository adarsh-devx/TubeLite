import { Video } from "lucide-react";
import type { VideoInfo } from "../types/download";

interface VideoPreviewCardProps {
  video: VideoInfo;
}

const VideoPreviewCard = ({ video }: VideoPreviewCardProps) => {
  return (
    <div className="w-full bg-bg-card rounded-2xl flex items-center p-3 gap-3 min-w-0">
      {/* Thumbnail with duration overlay */}
      <div className="relative w-[120px] sm:w-[140px] aspect-video rounded-xl overflow-hidden shrink-0 bg-[#27272a]">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Video className="w-8 h-8 text-text-secondary/50" strokeWidth={1.5} />
          </div>
        )}
        {/* Duration badge */}
        <span className="absolute bottom-1.5 right-1.5 bg-black/75 text-white text-[11px] font-medium px-1.5 py-0.5 rounded-md">
          {video.duration}
        </span>
      </div>

      {/* Video info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-[15px] font-semibold text-text-primary leading-snug truncate">
          {video.title}
        </h3>
        <p className="text-[13px] text-text-secondary mt-1 truncate">
          {video.channel}
        </p>
      </div>
    </div>
  );
};

export default VideoPreviewCard;
