import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { GATEWAY_URL } from './ui/config';

const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'manifest.json'), 'utf8'));

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
