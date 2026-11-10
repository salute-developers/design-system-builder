/// <reference types="vite/client" />

import { describe, expect, it } from 'vitest';

const sources = import.meta.glob<string>(['./*.ts', '../shared/*.ts', '!./*.test.ts'], {
    query: '?raw',
    import: 'default',
    eager: true,
});

describe('основной поток', () => {
    it('находит файлы основного потока', () => {
        expect(Object.keys(sources)).toContain('./applyExportPlan.ts');
    });

    it.each(Object.entries(sources))('%s не обращается к сети и не знает путей API', (_, text) => {
        expect(text).not.toMatch(/\bfetch\b\??\.?\(/);
        expect(text).not.toMatch(/XMLHttpRequest|WebSocket/);
        expect(text).not.toMatch(/\/(api|auth|realms)\//);
    });
});
