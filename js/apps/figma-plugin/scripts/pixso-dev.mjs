import console from 'node:console';
import { readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

// Порт и путь заданы отладчиком Pixso. Адрес IPv4: `localhost` в Node может занять только `::1`.
const HOST = '127.0.0.1';
const PORT = 5201;
const PATH = '/plugin';
const BUNDLE_DIR = 'dist-pixso';
const FILES = { manifest: 'manifest.json', main: 'code.js', ui: 'ui.html' };

/** Сообщения отладчику. Окно уходит готовым HTML: так его origin `null`, который разрешает gateway. */
export const readBundle = (dir) =>
    Object.entries(FILES).map(([name, file]) => ({ name, content: readFileSync(resolve(dir, file), 'utf8') }));

const sendBundle = (socket, dir) => {
    try {
        readBundle(dir).forEach((message) => socket.send(JSON.stringify(message)));
    } catch (error) {
        console.error(`Не удалось прочитать сборку: ${error.message}`);
        socket.close();
    }
};

/** Отдаёт сборку каждому подключению и перечитывает её, чтобы новая сборка не требовала перезапуска. */
export const serveBundle = (dir, port = PORT) => {
    readBundle(dir);
    const server = new WebSocketServer({ host: HOST, port, path: PATH });
    server.on('connection', (socket) => {
        socket.on('error', (error) => console.error(`Ошибка подключения отладчика: ${error.message}`));
        sendBundle(socket, dir);
    });
    return server;
};

const fail = (message) => {
    console.error(message);
    process.exit(1);
};

if (realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        serveBundle(BUNDLE_DIR)
            .on('listening', () => console.log(`Отладчик Pixso: ws://localhost:${PORT}${PATH}`))
            .on('error', (error) => fail(`Порт ${PORT} недоступен: ${error.message}`));
    } catch (error) {
        fail(`Нет сборки в ${BUNDLE_DIR}: выполните npm run build:pixso:dev (${error.message})`);
    }
}
