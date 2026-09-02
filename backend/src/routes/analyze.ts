import type { IncomingMessage, ServerResponse } from 'node:http';
import { analyzeUrl, YtDlpError } from '../services/ytDlpService';
import { isValidHttpUrl } from '../utils/validation';

export async function analyzeRoute(req: IncomingMessage, res: ServerResponse) {
  let body = '';

  req.on('data', (chunk) => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const payload = body ? JSON.parse(body) : {};
      const url = typeof payload.url === 'string' ? payload.url.trim() : '';

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

      const result = await analyzeUrl(url);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      if (error instanceof SyntaxError) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request body must be valid JSON' }));
        return;
      }

      const statusCode = error instanceof YtDlpError ? error.statusCode : 500;
      const message = error instanceof Error ? error.message : 'Unknown error';
      const code = error instanceof YtDlpError ? error.code : 'INTERNAL_ERROR';
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: message, code }));
    }
  });
}
