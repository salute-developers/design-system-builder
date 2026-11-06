import console from 'node:console';
import { copyFileSync, existsSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// Основному потоку нужен только API редактора: сеть остаётся за общими Kotlin-модулями в окне.
const FORBIDDEN_IN_MAIN = /\b(figma|fetch|XMLHttpRequest|WebSocket)\b|design-system-builder\.ru|localhost:8080/;

const checkMain = (file) => {
    const code = readFileSync(file, 'utf8');
    const forbidden = code.match(FORBIDDEN_IN_MAIN);
    if (forbidden) throw new Error(`dist-pixso/code.js: недопустимо «${forbidden[0]}»`);
    if (!/\bpixso\b/.test(code)) throw new Error('dist-pixso/code.js: нет обращения к pixso');
};

/** Дополняет `dist-pixso` общим окном и манифестом: окно не собирается отдельно, поэтому не расходится с Figma. */
export const packPixso = (root) => {
    const window = resolve(root, 'dist/ui.html');
    if (!existsSync(window)) throw new Error('Нет dist/ui.html: сначала выполните npm run build');
    checkMain(resolve(root, 'dist-pixso/code.js'));
    copyFileSync(window, resolve(root, 'dist-pixso/ui.html'));
    copyFileSync(resolve(root, 'manifest.pixso.json'), resolve(root, 'dist-pixso/manifest.json'));
};

if (realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        packPixso(process.cwd());
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}
