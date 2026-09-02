import 'dotenv/config';
import http from 'node:http';
import { URL } from 'node:url';
import { analyzeRoute } from './routes/analyze';
import { downloadRoute } from './routes/download';
import { healthRoute } from './routes/health';
import { getCompletedDownloadFile, getDownloadStatus } from './services/downloadService';
import { createReadStream } from 'node:fs';
import { config } from './utils/config';

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && (config.corsOrigins.includes('*') || config.corsOrigins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const requestUrl = req.url ? new URL(req.url, `http://${req.headers.host || 'localhost'}`) : null;

  if (!requestUrl) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid request URL' }));
    return;
  }

  try {
    if (req.method === 'GET' && requestUrl.pathname === '/health') {
      await healthRoute(req, res);
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/analyze') {
      await analyzeRoute(req, res);
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/download') {
      await downloadRoute(req, res);
      return;
    }

    const statusMatch = requestUrl.pathname.match(/^\/api\/download\/([^/]+)$/);
    if (req.method === 'GET' && statusMatch) {
      console.log('[DownloadAPI] status request:', statusMatch[1]);
      const status = getDownloadStatus(statusMatch[1]);
      if (!status) {
        console.log('[DownloadAPI] status response:', JSON.stringify({ error: 'Download job not found' }));
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Download job not found' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const response = JSON.stringify(status);
      console.log('[DownloadAPI] status response:', response);
      res.end(response);
      return;
    }

    const fileMatch = requestUrl.pathname.match(/^\/api\/download\/([^/]+)\/file$/);
    if (req.method === 'GET' && fileMatch) {
      console.log('[DownloadAPI] file request:', fileMatch[1]);
      const file = await getCompletedDownloadFile(fileMatch[1]);
      console.log('[DownloadAPI] file response:', { status: 200, filename: file.filename, size: file.size });
      res.writeHead(200, {
        'Content-Type': file.filename.toLowerCase().endsWith('.mp3') ? 'audio/mpeg' : 'video/mp4',
        'Content-Length': file.size,
        'Content-Disposition': `attachment; filename="${file.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
      });
      createReadStream(file.path).pipe(res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (requestUrl.pathname.startsWith('/api/download/')) {
      console.log('[DownloadAPI] file/status response:', JSON.stringify({ status: 500, error: message }));
    }
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: message }));
  }
});

server.listen(config.port, config.host, () => {
  console.log(`TubeLite backend listening on http://${config.host}:${config.port}`);
});
