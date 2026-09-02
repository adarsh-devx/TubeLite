import type { IncomingMessage, ServerResponse } from 'node:http';

export async function healthRoute(_req: IncomingMessage, res: ServerResponse) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', service: 'tubelite-backend' }));
}
