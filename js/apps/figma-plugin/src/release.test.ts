import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { EDITORS, checkManifest, checkWindow, packEditor, releaseVersion } from '../scripts/release-archive.mjs';

const figmaWindow = `<script>const gateway = "${EDITORS.figma.gateway}";</script>`;
const pixsoWindow = `<script>const gateway = "${EDITORS.pixso.gateway}";</script>`;

describe('версия релиза плагина', () => {
    it('берётся из тега tokens-plugin-vX.Y.Z, совпадающего с package.json', () => {
        expect(releaseVersion('tokens-plugin-v0.1.0', '0.1.0')).toBe('0.1.0');
    });

    it('не принимает чужой тег и расхождение с package.json', () => {
        expect(() => releaseVersion('cli-v0.1.0', '0.1.0')).toThrow('не похож');
        expect(() => releaseVersion('tokens-plugin-v0.1', '0.1.0')).toThrow('не похож');
        expect(() => releaseVersion('tokens-plugin-v0.2.0', '0.1.0')).toThrow('не совпадает');
    });
});

describe('окно плагина в релизе', () => {
    it('Figma ходит в боевой gateway, разрешённый манифестом', () => {
        const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'manifest.json'), 'utf8'));
        expect(manifest.networkAccess.allowedDomains).toContain(EDITORS.figma.gateway);
        expect(() => checkWindow(figmaWindow, 'figma')).not.toThrow();
    });

    it('Pixso ходит через шлюз Yandex Cloud', () => {
        expect(EDITORS.pixso.gateway).toMatch(/\.apigw\.yandexcloud\.net$/);
        expect(() => checkWindow(pixsoWindow, 'pixso')).not.toThrow();
    });

    it('не пропускает чужой gateway и адреса разработки', () => {
        expect(() => checkWindow(pixsoWindow, 'figma')).toThrow('не обращается');
        expect(() => checkWindow(figmaWindow + pixsoWindow, 'figma')).toThrow('чужому gateway');
        expect(() => checkWindow(`${figmaWindow}"http://localhost:8080"`, 'figma')).toThrow('адресу разработки');
        expect(() => checkWindow(`${pixsoWindow}"https://gateway-dev.design-system-builder.ru"`, 'pixso')).toThrow(
            'адресу разработки',
        );
    });
});

describe('манифесты в релизе', () => {
    const read = (file: string) => JSON.parse(readFileSync(resolve(process.cwd(), file), 'utf8'));

    it('указывают на файлы, которые кладутся в архив', () => {
        expect(() => checkManifest(read('manifest.json'), 'figma')).not.toThrow();
        expect(() => checkManifest(read('manifest.pixso.json'), 'pixso')).not.toThrow();
        expect(() => checkManifest({ main: 'code.js', ui: 'ui.html' }, 'figma')).toThrow('main');
    });
});

describe('архив редактора', () => {
    let root: string | undefined;

    afterEach(() => {
        if (root) rmSync(root, { recursive: true, force: true });
        root = undefined;
    });

    const prepare = () => {
        root = mkdtempSync(join(tmpdir(), 'tokens-plugin-release-'));
        mkdirSync(join(root, 'dist'));
        mkdirSync(join(root, 'dist-pixso'));
        writeFileSync(join(root, 'manifest.json'), readFileSync(resolve(process.cwd(), 'manifest.json')));
        writeFileSync(join(root, 'dist/code.js'), 'figma.showUI(__html__);');
        writeFileSync(join(root, 'dist/ui.html'), figmaWindow);
        writeFileSync(
            join(root, 'dist-pixso/manifest.json'),
            readFileSync(resolve(process.cwd(), 'manifest.pixso.json')),
        );
        writeFileSync(join(root, 'dist-pixso/code.js'), 'pixso.showUI(__html__);');
        writeFileSync(join(root, 'dist-pixso/ui.html'), pixsoWindow);
        return root;
    };

    const entries = (archive: string) =>
        execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' }).trim().split('\n').sort();

    it('Figma: манифест, dist и инструкция в папке плагина', () => {
        const dir = prepare();
        const archive = packEditor(dir, 'figma', '0.1.0', join(dir, 'release'));

        expect(archive).toMatch(/ds-builder-tokens-figma-0\.1\.0\.zip$/);
        expect(entries(archive)).toEqual([
            'ds-builder-tokens-figma/',
            'ds-builder-tokens-figma/README.txt',
            'ds-builder-tokens-figma/dist/',
            'ds-builder-tokens-figma/dist/code.js',
            'ds-builder-tokens-figma/dist/ui.html',
            'ds-builder-tokens-figma/manifest.json',
        ]);
        const readme = execFileSync('unzip', ['-p', archive, 'ds-builder-tokens-figma/README.txt'], {
            encoding: 'utf8',
        });
        expect(readme).toContain('Import plugin from manifest');
        expect(readme).toContain('Версия 0.1.0');
    });

    it('Pixso: манифест, code.js и ui.html рядом', () => {
        const dir = prepare();
        const archive = packEditor(dir, 'pixso', '0.1.0', join(dir, 'release'));

        expect(entries(archive)).toEqual([
            'ds-builder-tokens-pixso/',
            'ds-builder-tokens-pixso/README.txt',
            'ds-builder-tokens-pixso/code.js',
            'ds-builder-tokens-pixso/manifest.json',
            'ds-builder-tokens-pixso/ui.html',
        ]);
    });

    it('не собирается из окна с чужим gateway', () => {
        const dir = prepare();
        writeFileSync(join(dir, 'dist-pixso/ui.html'), figmaWindow);

        expect(() => packEditor(dir, 'pixso', '0.1.0', join(dir, 'release'))).toThrow('не обращается');
    });
});
