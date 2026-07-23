/* global URL, console, process */

import { execFileSync } from 'node:child_process';
import { createReadStream, mkdtempSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve, sep } from 'node:path';

const artifactPath = resolve(process.argv[2] ?? '');
const port = Number(process.argv[3] ?? 8081);
let temporaryRoot;
const root =
    extname(artifactPath) === '.zip'
        ? (() => {
              temporaryRoot = mkdtempSync(join(tmpdir(), 'dsbuilder-compose-plugin-'));
              execFileSync('unzip', ['-q', '-o', artifactPath, '-d', temporaryRoot]);
              return temporaryRoot;
          })()
        : artifactPath;
const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.wasm': 'application/wasm',
};

if (!process.argv[2]) {
    throw new Error('Usage: node scripts/serve-compose-plugin.mjs <artifact-directory> [port]');
}

const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    const candidate = resolve(root, `.${normalize(pathname)}`);

    response.setHeader('Access-Control-Allow-Origin', '*');
    if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
        response.writeHead(403).end('Forbidden');
        return;
    }

    let file = candidate;
    try {
        if (statSync(file).isDirectory()) file = join(file, 'index.html');
        const type = contentTypes[extname(file)];
        if (type) response.setHeader('Content-Type', type);
        createReadStream(file)
            .on('error', () => response.writeHead(404).end('Not found'))
            .pipe(response);
    } catch {
        response.writeHead(404).end('Not found');
    }
});

const shutdown = () => {
    server.close(() => {
        if (temporaryRoot) rmSync(temporaryRoot, { recursive: true, force: true });
        process.exit(0);
    });
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

server.listen(port, '127.0.0.1', () => {
    console.log(`Compose preview plugin: http://127.0.0.1:${port}/`);
});
