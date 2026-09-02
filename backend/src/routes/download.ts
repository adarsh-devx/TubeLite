import type { IncomingMessage, ServerResponse } from 'node:http';
import { createDownloadJob, DownloadServiceError } from '../services/downloadService';
import { isValidHttpUrl } from '../utils/validation';

export async function downloadRoute(req: IncomingMessage, res: ServerResponse) {
  console.log('[DownloadAPI] request received');
  let body = '';

  req.on('data', (chunk) => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const payload = body ? JSON.parse(body) : {};
      const url = typeof payload.url === 'string' ? payload.url.trim() : '';
      const quality = typeof payload.quality === 'string' ? payload.quality : '720p';
      const kind = payload.kind === 'mp3' ? 'mp3' : 'video';

      if (!url) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'URL is required' }));
        return;
      }

      if (!isValidHttpUrl(url)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'URL must be a valid http/https URL' }));
        return;
      }

      console.log('[Download] POST /api/download received:', { url, quality, kind });
      const jobId = createDownloadJob(url, quality, kind);
      const response = { jobId };
      console.log('[DownloadAPI] response:', response);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    } catch (error) {
      if (error instanceof SyntaxError) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request body must be valid JSON' }));
        return;
      }

      const statusCode = error instanceof DownloadServiceError ? error.statusCode : 500;
      const message = error instanceof Error ? error.message : 'Unknown error';
      const code = error instanceof DownloadServiceError ? error.code : 'INTERNAL_ERROR';
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: message, code }));
    }
  });
}
