/* eslint-disable no-undef */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dist = process.env.FORM_DIST ? path.resolve(process.env.FORM_DIST) : path.join(root, 'apps/web/dist');
const port = Number(process.env.PORT || 8080);
const mime = new Map(Object.entries({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.map': 'application/json; charset=utf-8', '.ico': 'image/x-icon' }));
function securityHeaders(file) {
  const immutable = file.includes(`${path.sep}assets${path.sep}`);
  const noCache = file.endsWith('index.html') || file.endsWith('sw.js') || file.endsWith('manifest.webmanifest');
  return {
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-resource-policy': 'same-origin',
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : noCache ? 'no-cache' : 'public, max-age=300'
  };
}
export function createProductionServer(distDir = dist) {
  return http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.includes('..')) { res.writeHead(400); res.end('bad path'); return; }
    let file = path.join(distDir, pathname === '/' ? 'index.html' : pathname);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      if ((req.method === 'GET' || req.method === 'HEAD') && !path.extname(pathname)) file = path.join(distDir, 'index.html');
      else { res.writeHead(404); res.end('not found'); return; }
    }
    const type = mime.get(path.extname(file)) || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, ...securityHeaders(file) });
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
  });
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^\//, ''))) {
  const server = createProductionServer();
  server.listen(port, () => console.log(`production-server http://localhost:${port} dist=${dist}`));
}
