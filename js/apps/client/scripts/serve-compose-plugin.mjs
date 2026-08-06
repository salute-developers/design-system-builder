/* global URL, console, process */

import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve, sep } from 'node:path';

const artifactArgument = process.argv[2] || process.env.COMPOSE_PREVIEW_PLUGIN_ARTIFACT;
if (!artifactArgument) {
    throw new Error(
        'Compose plugin artifact is not configured. Pass its path as the first argument or set ' +
            'COMPOSE_PREVIEW_PLUGIN_ARTIFACT=/path/to/preview-compose-plugin.zip',
    );
}
const artifactPath = resolve(artifactArgument);
if (!existsSync(artifactPath)) {
    throw new Error(`Compose plugin artifact does not exist: ${artifactPath}`);
}
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
