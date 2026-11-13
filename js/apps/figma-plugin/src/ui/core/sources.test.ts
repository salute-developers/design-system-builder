import { describe, expect, it } from 'vitest';

const sources = import.meta.glob<string>(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}', '!./generated/**'], {
    query: '?raw',
    import: 'default',
    eager: true,
});

describe('интеграция с бэкендом', () => {
    it('находит файлы окна', () => {
        expect(Object.keys(sources)).toContain('../App.tsx');
    });

    it.each(Object.entries(sources))('%s не обращается к бэкенду напрямую', (_, text) => {
        expect(text).not.toMatch(/\bfetch\b\??\.?\(/);
        expect(text).not.toMatch(/(?<![.\w])\/(api|auth|realms)\//);
    });
});
