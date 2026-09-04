import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../utils/config';
import { isValidHttpUrl } from '../utils/validation';

export interface DownloadResult {
  title: string;
  filename: string;
  filepath: string;
  format: string;
  size: string;
  duration: string;
  thumbnail: string;
}

export interface DownloadStatus {
  jobId: string;
  status: 'queued' | 'downloading' | 'completed' | 'failed';
  progress: number;
  downloaded: string;
  total: string;
  speed: string;
  eta: string;
  result?: DownloadResult;
  error?: string;
}

const jobs = new Map<string, DownloadStatus>();

export class DownloadServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'DownloadServiceError';
  }
}

export function createDownloadJob(
  url: string,
  quality: string,
  kind: 'video' | 'mp3' = 'video',
): string {
  if (!isValidHttpUrl(url)) {
    throw new DownloadServiceError('Please enter a valid YouTube link.', 400, 'INVALID_URL');
  }

  const jobId = randomUUID();
  jobs.set(jobId, {
    jobId,
    status: 'queued',
    progress: 0,
    downloaded: '0 MB',
    total: '—',
    speed: '—',
    eta: '—',
  });
  console.log('[Download] job created:', jobId);
  void runDownloadJob(jobId, url, quality, kind);
  return jobId;
}

export function getDownloadStatus(jobId: string): DownloadStatus | undefined {
  return jobs.get(jobId);
}

export async function getCompletedDownloadFile(jobId: string): Promise<{
  path: string;
  filename: string;
  size: number;
}> {
  const job = jobs.get(jobId);
  if (job?.status !== 'completed' || !job.result) {
    throw new DownloadServiceError('Download is not complete.', 404, 'DOWNLOAD_NOT_COMPLETE');
  }

  const downloadDir = path.join(os.tmpdir(), 'tubelite-downloads');
  const filePath = path.resolve(job.result.filepath);
  if (path.dirname(filePath) !== path.resolve(downloadDir)) {
    throw new DownloadServiceError('Download file is outside the download directory.', 403, 'INVALID_DOWNLOAD_PATH');
  }

  const stat = await fs.stat(filePath);
  return { path: filePath, filename: path.basename(filePath), size: stat.size };
}

async function runDownloadJob(
  jobId: string,
  url: string,
  quality: string,
  kind: 'video' | 'mp3',
): Promise<void> {
  try {
    const result = await downloadVideo(url, quality, kind, jobId);
    const job = jobs.get(jobId);
    if (job) {
      job.status = 'completed';
      job.progress = 100;
      job.result = result;
    }
    console.log('[Download] final output path:', result.filepath);
  } catch (error) {
    const job = jobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Download failed';
    }
    console.error('[Download] job failed:', jobId, error);
  }
}

async function downloadVideo(
  url: string,
  quality: string,
  kind: 'video' | 'mp3' = 'video',
  jobId?: string,
): Promise<DownloadResult> {

  const downloadDir = path.join(os.tmpdir(), 'tubelite-downloads');
  await fs.mkdir(downloadDir, { recursive: true });

  const targetFormat = buildFormatSelector(quality, kind);
  console.log('[Download] yt-dlp format selector:', targetFormat);
  const outputTemplate = path.join(downloadDir, '%(title)s.%(ext)s');

 const args = [
  url,
  '--no-playlist',
  '--no-warnings',
  '--no-check-certificates',
  '--restrict-filenames',
  '--newline',

  '--js-runtimes',
  'node:/usr/local/bin/node',

  '--output',
  outputTemplate,
  '-f',
  targetFormat,
];

  if (kind === 'video') {
    args.push('--merge-output-format', 'mp4');
  } else {
    args.push('--extract-audio', '--audio-format', 'mp3', '--audio-quality', '0');
  }

  await new Promise<void>((resolve, reject) => {
    const job = jobId ? jobs.get(jobId) : undefined;
    const child = spawn(config.ytdlpBinary, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
    console.log('[Download] yt-dlp process started:', jobId ?? '<sync>');
    if (job) job.status = 'downloading';

    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new DownloadServiceError('The download timed out.', 504, 'DOWNLOAD_TIMEOUT'));
    }, config.ytdlpTimeoutMs);

    child.stderr.on('data', (chunk) => {
      const output = chunk.toString();
      stderr += output;
      updateProgress(job, output);
    });

    child.stdout.on('data', (chunk) => {
      updateProgress(job, chunk.toString());
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        reject(new DownloadServiceError(`yt-dlp executable not found: ${config.ytdlpBinary}`, 503, 'YTDLP_NOT_INSTALLED'));
        return;
      }
      reject(new DownloadServiceError(`yt-dlp execution failed: ${error.message}`, 502, 'YTDLP_EXECUTION_FAILED'));
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      console.log('[Download] yt-dlp process exit code:', code);
      if (code !== 0) {
        reject(new DownloadServiceError(stderr.trim() || `yt-dlp exited with status ${code}`, 502, 'YTDLP_EXECUTION_FAILED'));
        return;
      }
      resolve();
    });
  });

  const outputFile = await findLatestDownloadedFile(downloadDir, kind);
  if (!outputFile) {
    throw new DownloadServiceError('The download completed but no output file was produced.', 500, 'OUTPUT_ERROR');
  }

  const stat = await fs.stat(outputFile);
  const title = path.basename(outputFile, path.extname(outputFile));

  return {
    title,
    filename: path.basename(outputFile),
    filepath: outputFile,
    format: kind === 'mp3' ? 'MP3' : 'MP4',
    size: formatFilesize(stat.size),
    duration: '0:00',
    thumbnail: '',
  };
}

function updateProgress(job: DownloadStatus | undefined, output: string): void {
  if (!job || !output.trim()) return;
  console.log('[Download] first yt-dlp output/progress event:', output.trim().split(/\r?\n/)[0]);
  const match = output.match(/(\d+(?:\.\d+)?)%.*?of\s+([^\s]+).*?at\s+([^\s]+).*?ETA\s+([^\s]+)/i);
  if (match) {
    job.progress = Number(match[1]);
    job.total = match[2];
    job.speed = match[3];
    job.eta = match[4];
  }
}

function buildFormatSelector(quality: string, kind: 'video' | 'mp3'): string {
  if (kind === 'mp3') {
    return 'bestaudio/best';
  }

  const height = parseQualityHeight(quality);

  return `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best`;
}

function parseQualityHeight(quality: string): number {
  const normalized = quality.toLowerCase();
  if (normalized.includes('4k') || normalized.includes('2160')) return 2160;
  if (normalized.includes('2k') || normalized.includes('1440')) return 1440;
  if (normalized.includes('1080')) return 1080;
  if (normalized.includes('720')) return 720;
  if (normalized.includes('480')) return 480;
  if (normalized.includes('360')) return 360;
  if (normalized.includes('240')) return 240;
  if (normalized.includes('144')) return 144;
  return 720;
}

async function findLatestDownloadedFile(dir: string, kind: 'video' | 'mp3'): Promise<string | null> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(dir, entry.name))
    .filter((file) => {
      if (kind === 'mp3') return file.toLowerCase().endsWith('.mp3');
      return file.toLowerCase().endsWith('.mp4') || file.toLowerCase().endsWith('.m4a');
    });

  if (files.length === 0) return null;

  const { mtimeMs } = await fs.stat(files[0]);
  let latest = files[0];
  let latestTime = mtimeMs;

  for (const file of files.slice(1)) {
    const stat = await fs.stat(file);
    if (stat.mtimeMs > latestTime) {
      latest = file;
      latestTime = stat.mtimeMs;
    }
  }

  return latest;
}

function formatFilesize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
