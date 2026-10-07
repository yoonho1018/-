import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { configuration, configScript } from './config.mjs';
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const config = configuration(process.env);
const root = path.resolve('public');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/config.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' });
      return res.end(configScript(config));
    }
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep) || !(await stat(file)).isFile()) throw new Error('Not found');
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('Not found'); }
});
let port = Number(process.env.PORT || 5173);
server.on('error', error => {
  if (error.code === 'EADDRINUSE') server.listen(++port, '127.0.0.1');
  else throw error;
});
server.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${server.address().port}`));
