import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { GATEWAY_URL } from './ui/config';

const readManifest = (file: string) => JSON.parse(readFileSync(resolve(process.cwd(), file), 'utf8'));
const manifest = readManifest('manifest.json');
const pixsoManifest = readManifest('manifest.pixso.json');

describe('манифест плагина', () => {
    it('разрешает боевой gateway, CDN шрифтов и локальный gateway для разработки', () => {
        expect(manifest.networkAccess.allowedDomains).toEqual([
            'https://gateway.design-system-builder.ru',
            'https://cdn-app.sberdevices.ru',
        ]);
        expect(manifest.networkAccess.devAllowedDomains).toEqual(['http://localhost:8080']);
        expect(manifest.networkAccess.allowedDomains).toContain(GATEWAY_URL);
    });

    it('использует асинхронный доступ к документу, нужный экспорту', () => {
        expect(manifest.documentAccess).toBe('dynamic-page');
    });
});

describe('манифест Pixso', () => {
    it('описывает тот же плагин и файлы своей сборки', () => {
        expect(pixsoManifest).toEqual({
            name: manifest.name,
            id: manifest.id,
            main: 'code.js',
            ui: 'ui.html',
            editorType: ['pixso'],
        });
    });

    it('не меняет манифест Figma', () => {
        expect(manifest.editorType).toEqual(['figma']);
        expect(manifest.main).toBe('dist/code.js');
    });
});
