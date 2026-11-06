import { afterEach, describe, expect, it, vi } from 'vitest';

import { DsBuilderCore } from './generated/dsbuilder-core.mjs';
import { ApiError, createPluginCore } from './pluginCore';

/** Настоящий Kotlin-модуль: проверяет границу с JS, которую подмена в остальных тестах не видит. */
const createCore = (initial: string | null = 'saved') => {
    const values = new Map(initial ? [['refresh-token', initial]] : []);
    const storage = {
        get: async (key: string) => values.get(key) ?? null,
        set: async (key: string, value: string) => void values.set(key, value),
        delete: async (key: string) => void values.delete(key),
    };
    return { core: createPluginCore(new DsBuilderCore('https://gateway.test', 'client', 'dsbuilder', storage)), values };
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const tokens = { access_token: 'access', refresh_token: 'next', expires_in: 300 };

const route = (answer: (url: string, init?: RequestInit) => Promise<Response> | Response) =>
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => answer(url, init)));

afterEach(() => void vi.unstubAllGlobals());

describe('Kotlin-модуль в окне', () => {
    it('сбой сети при восстановлении не теряет сессию', async () => {
        route(() => {
            throw new TypeError('Failed to fetch');
        });
        const { core, values } = createCore();

        const error = await core.restore().catch((reason: unknown) => reason);

        expect(error).toBeInstanceOf(ApiError);
        expect(error).toHaveProperty('kind', 'network');
        expect(values.get('refresh-token')).toBe('saved');
    });

    it('восстанавливает сессию и читает данные с описаниями', async () => {
        route((url) =>
            url.endsWith('/auth/token') ? json(tokens) : json([{ id: 'p1', name: 'Project', description: 'About' }]),
        );
        const { core, values } = createCore();

        await expect(core.restore()).resolves.toBe(true);

        await expect(core.api.projects()).resolves.toEqual([{ id: 'p1', name: 'Project', description: 'About' }]);
        expect(values.get('refresh-token')).toBe('next');
    });

    it('отменяет запрос по сигналу', async () => {
        let requested = () => {};
        const started = new Promise<void>((resolve) => (requested = resolve));
        let signal: AbortSignal | null | undefined;
        route((url, init) => {
            if (url.endsWith('/auth/token')) return json(tokens);
            signal = init?.signal;
            requested();
            return new Promise(() => undefined);
        });
        const { core } = createCore();
        await core.restore();
        const controller = new AbortController();

        const reading = core.api.projects(controller.signal).catch((reason: unknown) => reason);
        await started;
        controller.abort();

        expect(await reading).not.toBeInstanceOf(ApiError);
        expect(signal?.aborted).toBe(true);
    });
});
