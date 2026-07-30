#!/usr/bin/env node
/**
 * Minimal static server for the `out/` export.
 *
 * Tests run against this rather than `next dev` so they exercise the same
 * artifact that gets deployed — trailing-slash routing, prerendered HTML and
 * all. Zero dependencies on purpose.
 *
 * Usage: node scripts/serve-static.ts [--port 3100] [--dir out]
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const arg = (flag: string, fallback: string) => {
  const i = process.argv.indexOf(`--${flag}`);
  return i === -1 ? fallback : process.argv[i + 1];
};

const PORT = Number(arg('port', '3100'));
const ROOT = path.resolve(process.cwd(), arg('dir', 'out'));

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};

function resolveFile(urlPath: string): string | null {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  // Contain traversal to ROOT.
  const target = path.normalize(path.join(ROOT, clean));
  if (!target.startsWith(ROOT)) return null;

  if (existsSync(target) && statSync(target).isFile()) return target;
  const asIndex = path.join(target, 'index.html');
  if (existsSync(asIndex)) return asIndex;
  const asHtml = `${target.replace(/\/$/, '')}.html`;
  if (existsSync(asHtml)) return asHtml;
  return null;
}

createServer((req, res) => {
  const file = resolveFile(req.url ?? '/');
  if (!file) {
    const notFound = path.join(ROOT, '404.html');
    if (existsSync(notFound)) {
      res.writeHead(404, { 'Content-Type': TYPES['.html'] });
      createReadStream(notFound).pipe(res);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(PORT, () => {
  console.log(`serving ${path.relative(process.cwd(), ROOT)} at http://localhost:${PORT}`);
});
