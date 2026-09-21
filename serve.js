// Static file server ONLY (no API, no state). Needed because browsers block fetch() of data/*.json from file://.
// Serves web/ at / and data/ at /data/. Equivalent alternative: `python -m http.server` from the repo root, open /web/.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const rel = p === '/' ? 'web/index.html' : p.startsWith('/data/') ? p.slice(1) : 'web' + p;
  const file = path.normalize(path.join(root, rel));
  const ok = file.startsWith(path.join(root, 'web') + path.sep) || file.startsWith(path.join(root, 'data') + path.sep);
  if (!ok || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(fs.readFileSync(file));
}).listen(process.env.PORT || 3000, () => console.log(`KARGO mockup: http://localhost:${process.env.PORT || 3000}`));
