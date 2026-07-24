import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const rootDir = path.resolve(process.cwd(), 'docs/Requirements');
const host = process.env.REQUIREMENTS_HOST || '127.0.0.1';
const port = Number(process.env.REQUIREMENTS_PORT || 4173);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.mmd': 'text/plain; charset=utf-8',
};

function safeResolve(requestPath) {
  const normalized = path.normalize(decodeURIComponent(requestPath)).replace(/^([/\\])+/, '');
  const resolved = path.resolve(rootDir, normalized);
  if (!resolved.startsWith(rootDir)) {
    return null;
  }
  return resolved;
}

function send(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = contentTypes[ext] || 'application/octet-stream';
  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
      return;
    }

    send(res, 200, data, { 'Content-Type': contentType });
  });
}

const server = http.createServer((req, res) => {
  const requestUrl = new url.URL(req.url || '/', `http://${req.headers.host || `${host}:${port}`}`);
  let pathname = requestUrl.pathname;

  if (pathname === '/') {
    pathname = '/index.html';
  }

  const filePath = safeResolve(pathname);
  if (!filePath) {
    send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (error) {
      send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
      return;
    }

    if (stats.isDirectory()) {
      sendFile(res, path.join(filePath, 'index.html'));
      return;
    }

    sendFile(res, filePath);
  });
});

server.listen(port, host, () => {
  console.log(`Requirements catalog serving at http://${host}:${port}`);
  console.log(`Serving folder: ${rootDir}`);
});
