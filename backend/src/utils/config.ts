export const config = {
  host: process.env.BACKEND_HOST || '127.0.0.1',
  port: Number(process.env.PORT || 3001),
  ytdlpBinary: process.env.YT_DLP_BINARY || 'yt-dlp',
  ffmpegBinary: process.env.FFMPEG_BINARY || 'ffmpeg',
  nodeBinary: process.env.NODE_BINARY || 'node',
  ytdlpForceIpv4: process.env.YT_DLP_FORCE_IPV4?.toLowerCase() === 'true',
  ytdlpTimeoutMs: Number(process.env.YT_DLP_TIMEOUT_MS || 30000),
  corsOrigins: (process.env.CORS_ORIGIN || 'http://tauri.localhost,https://tauri.localhost')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
