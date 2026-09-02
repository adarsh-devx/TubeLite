import { spawn } from 'node:child_process';
import { config } from '../utils/config';
import { formatFilesize, normalizeDuration, qualityLabel } from '../utils/validation';

export class YtDlpError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'YtDlpError';
  }
}

export interface YtDlpVideoFormat {
  quality: string;
  label: string;
  format: string;
  size: string;
}

export interface YtDlpAudioFormat {
  quality: string;
  label: string;
  bitrate: string;
  size: string;
}

export interface AnalyzedVideoResponse {
  title: string;
  channel: string;
  duration: string;
  thumbnail: string;
  video_formats: YtDlpVideoFormat[];
  audio_formats: YtDlpAudioFormat[];
}

export async function analyzeUrl(url: string): Promise<AnalyzedVideoResponse> {
  let lastError: unknown;
  let result: Record<string, any> | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      result = await runYtDlpJson(url);
      break;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : '';
      const isRetryable = msg.includes('Sign in to confirm')
        || msg.includes('bot')
        || msg.includes('HTTP Error 403')
        || msg.includes('HTTP Error 429');
      if (isRetryable && attempt < 2) {
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  if (!result) throw lastError;
  const formats = Array.isArray(result.formats) ? result.formats : [];

  const videoFormats: YtDlpVideoFormat[] = [];
  const audioFormats: YtDlpAudioFormat[] = [];
  const seenVideoQualities = new Set<string>();

  for (const format of formats) {
    const hasVideo = Boolean(format.vcodec && format.vcodec !== 'none');
    const hasAudio = Boolean(format.acodec && format.acodec !== 'none');
    const height = Number(format.height || 0);
    const ext = String(format.ext || 'mp4');
    const abr = Number(format.abr || 0);
    const fileSize = Number(format.filesize || format.filesize_approx || 0);

    if (hasVideo && height > 0 && ext.toLowerCase() === 'mp4') {
      const quality = `${height}p`;
      if (!seenVideoQualities.has(quality)) {
        seenVideoQualities.add(quality);
        videoFormats.push({
          quality,
          label: `${qualityLabel(height)} · ${formatFilesize(fileSize)}`,
          format: 'MP4',
          size: formatFilesize(fileSize),
        });
      }
    } else if (hasAudio && !hasVideo && abr > 0) {
      audioFormats.push({
        quality: `${ext.toUpperCase()} ${Math.round(abr)}`,
        label: `${abr >= 256 ? 'High Quality' : 'Standard'} · ${formatFilesize(fileSize)}`,
        bitrate: `${Math.round(abr)} kbps`,
        size: formatFilesize(fileSize),
      });
    }
  }

  videoFormats.sort((a, b) => parseInt(b.quality, 10) - parseInt(a.quality, 10));
  audioFormats.sort((a, b) => parseInt(b.bitrate, 10) - parseInt(a.bitrate, 10));

  return {
    title: String(result.title || 'Unknown Title'),
    channel: String(result.channel || result.uploader || 'Unknown Channel'),
    duration: normalizeDuration(Number(result.duration || 0)),
    thumbnail: String(result.thumbnail || ''),
    video_formats: videoFormats,
    audio_formats: audioFormats,
  };
}

function runYtDlpJson(url: string): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    const args = [
      url,
      '--dump-json',
      '--no-playlist',
      '--js-runtimes',
      `node:${config.nodeBinary}`,
      '--remote-components',
      'ejs:github',
      '--extractor-retries',
      '3',
      '--no-warnings',
    ];

    if (config.ytdlpForceIpv4) {
      args.push('--force-ipv4');
    }

    const child = spawn(config.ytdlpBinary, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        reject(new YtDlpError('yt-dlp timed out', 504, 'YTDLP_TIMEOUT'));
      }
    }, config.ytdlpTimeoutMs);

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback();
    };

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      finish(() => {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') {
          reject(new YtDlpError(`yt-dlp executable not found: ${config.ytdlpBinary}`, 503, 'YTDLP_NOT_INSTALLED'));
          return;
        }
        reject(new YtDlpError(`yt-dlp execution failed: ${error.message}`, 502, 'YTDLP_EXECUTION_FAILED'));
      });
    });

    child.on('close', (code) => {
      finish(() => {
        if (code !== 0) {
          reject(new YtDlpError(stderr.trim() || `yt-dlp exited with status ${code}`, 502, 'YTDLP_EXECUTION_FAILED'));
          return;
        }

        try {
          const parsed: unknown = JSON.parse(stdout.trim());
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('yt-dlp output was not a JSON object');
          }
          resolve(parsed as Record<string, any>);
        } catch (error) {
          reject(new YtDlpError(`Malformed yt-dlp JSON: ${String(error)}`, 502, 'YTDLP_MALFORMED_JSON'));
        }
      });
    });
  });
}
