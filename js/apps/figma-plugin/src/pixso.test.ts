// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket, { type WebSocketServer } from 'ws';

import { packPixso } from '../scripts/pack-pixso.mjs';
import { readBundle, serveBundle } from '../scripts/pixso-dev.mjs';

const roots: string[] = [];

const createRoot = () => {
    const root = mkdtempSync(join(tmpdir(), 'pixso-'));
    roots.push(root);
    return root;
};

const write = (root: string, files: Record<string, string>) =>
    Object.entries(files).forEach(([file, content]) => writeFileSync(join(root, file), content));

afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true })));

describe('сборка Pixso', () => {
    const createBuild = (main: string) => {
        const root = createRoot();
        mkdirSync(join(root, 'dist'));
        mkdirSync(join(root, 'dist-pixso'));
        write(root, {
            'dist/ui.html': '<html>общее окно</html>',
            'dist-pixso/code.js': main,
            'manifest.pixso.json': '{"name":"Pixso"}',
        });
        return root;
    };

    it('копирует окно сборки Figma без изменений и манифест Pixso', () => {
        const root = createBuild('start(pixso,__html__)');

        packPixso(root);

        expect(readFileSync(join(root, 'dist-pixso/ui.html'), 'utf8')).toBe('<html>общее окно</html>');
        expect(readFileSync(join(root, 'dist-pixso/manifest.json'), 'utf8')).toBe('{"name":"Pixso"}');
    });

    it('не собирается без окна', () => {
        expect(() => packPixso(createRoot())).toThrow('сначала выполните npm run build');
    });

    it.each([
        ['start(figma,__html__)', 'figma'],
        ['start(pixso);fetch("/x")', 'fetch'],
        ['start(pixso);new XMLHttpRequest()', 'XMLHttpRequest'],
        ['start(pixso);new WebSocket("ws://x")', 'WebSocket'],
        ['start(pixso,"https://gateway.design-system-builder.ru")', 'design-system-builder.ru'],
    ])('не принимает основной поток %s', (main, forbidden) => {
        expect(() => packPixso(createBuild(main))).toThrow(`недопустимо «${forbidden}»`);
    });

    it('не принимает основной поток без `pixso`', () => {
        expect(() => packPixso(createBuild('start(editor)'))).toThrow('нет обращения к pixso');
    });
});

describe('локальный запуск в отладчике', () => {
    let server: WebSocketServer | undefined;

    afterEach(() => server?.close());

    const createBundle = () => {
        const root = createRoot();
        write(root, { 'manifest.json': '{}', 'code.js': 'main', 'ui.html': '<html>' });
        return root;
    };

    const receive = (port: number, count: number) =>
        new Promise<unknown[]>((done, fail) => {
            const messages: unknown[] = [];
            const socket = new WebSocket(`ws://localhost:${port}/plugin`);
            socket.on('error', fail);
            socket.on('message', (data) => {
                messages.push(JSON.parse(String(data)));
                if (messages.length === count) {
                    socket.close();
                    done(messages);
                }
            });
        });

    const start = (root: string) =>
        new Promise<number>((done) => {
            server = serveBundle(root, 0);
            server.on('listening', () => done((server?.address() as { port: number }).port));
        });

    it('отправляет манифест, основной поток и окно в формате отладчика', async () => {
        const port = await start(createBundle());

        await expect(receive(port, 3)).resolves.toEqual([
            { name: 'manifest', content: '{}' },
            { name: 'main', content: 'main' },
            { name: 'ui', content: '<html>' },
        ]);
    });

    it('отдаёт новую сборку следующему подключению', async () => {
        const root = createBundle();
        const port = await start(root);
        await receive(port, 3);

        write(root, { 'code.js': 'rebuilt' });

        await expect(receive(port, 3)).resolves.toContainEqual({ name: 'main', content: 'rebuilt' });
    });

    it('не запускается без сборки', () => {
        expect(() => readBundle(createRoot())).toThrow();
        expect(() => serveBundle(createRoot(), 0)).toThrow();
    });

    it('объясняет, что сборки нет, и завершается с ошибкой', () => {
        const script = resolve(process.cwd(), 'scripts/pixso-dev.mjs');
        const result = spawnSync(process.execPath, [script], { cwd: createRoot(), encoding: 'utf8' });

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('выполните npm run build:pixso:dev');
    });
});
