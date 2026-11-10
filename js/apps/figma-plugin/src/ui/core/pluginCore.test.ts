import { describe, expect, it, vi } from 'vitest';

import { ApiError, ExportPlanError, OAuthError, StorageError, createPluginCore, type KotlinCore } from './pluginCore';

const context = { projectId: 'p1', designSystemId: 'd1', tenantId: 't1' };

const createKotlin = (overrides: Partial<KotlinCore> = {}): KotlinCore => ({
    onSessionExpired: vi.fn(),
    restore: vi.fn(async () => true),
    startLogin: vi.fn(async () => '{"userCode":"ABCD","verificationUri":"https://kc"}'),
    completeLogin: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
    projects: vi.fn(async () => '[{"id":"p1","name":"Project"}]'),
    designSystems: vi.fn(async () => '[]'),
    tenants: vi.fn(async () => '[{"id":"t1","name":null},{"id":"t2","name":"Dark"}]'),
    versions: vi.fn(async () => '[]'),
    themeTokens: vi.fn(async () => '{"tokens":[],"values":[],"typography":{"families":[],"screens":[]},"sizes":{}}'),
    exportPlan: vi.fn(async () => '{"collections":[],"skipped":[]}'),
    fontFile: vi.fn(async () => new Int8Array([79, 84, 84, 79])),
    ...overrides,
});

const failure = (kind: string, code: string | null = null) => Object.assign(new Error(kind), { kind, code });

describe('связь с Kotlin', () => {
    it('разбирает ответы и подписывает тему без названия', async () => {
        const { api } = createPluginCore(createKotlin());

        await expect(api.projects()).resolves.toEqual([{ id: 'p1', name: 'Project' }]);
        await expect(api.tenants(context)).resolves.toEqual([
            { id: 't1', name: 'Тема без названия' },
            { id: 't2', name: 'Dark' },
        ]);
    });

    it('строит снимок токенов и передаёт версию и отмену', async () => {
        const kotlin = createKotlin();
        const { signal } = new AbortController();

        const snapshot = await createPluginCore(kotlin).api.snapshot(context, 'v1', signal);

        expect(kotlin.themeTokens).toHaveBeenCalledWith('p1', 'd1', 't1', 'v1', signal);
        expect(snapshot.colors).toEqual([]);
    });

    it('получает план экспорта на выбранной границе и переводит сбой построения', async () => {
        const kotlin = createKotlin();
        const { signal } = new AbortController();

        const plan = await createPluginCore(kotlin).api.exportPlan(context, null, 'Malachite', signal);

        expect(kotlin.exportPlan).toHaveBeenCalledWith('p1', 'd1', 't1', null, 'Malachite', signal);
        expect(plan.collections).toEqual([]);
        const broken = createPluginCore(
            createKotlin({ exportPlan: vi.fn().mockRejectedValue(failure('export', 'bad')) }),
        );
        const error = await broken.api.exportPlan(context, null, 'Malachite').catch((reason: unknown) => reason);
        expect(error).toBeInstanceOf(ExportPlanError);
        expect(error).toHaveProperty('message', 'Не удалось построить план экспорта: bad');
    });

    it.each([
        ['forbidden', 'Нет доступа'],
        ['not-found', 'Данные не найдены'],
        ['unauthorized', 'Нужно войти снова'],
        ['network', 'Сервер DS Builder недоступен'],
        ['server', 'Сервер DS Builder ответил ошибкой'],
    ])('переводит отказ `%s` в сообщение экрана', async (kind, message) => {
        const { api } = createPluginCore(createKotlin({ projects: vi.fn().mockRejectedValue(failure(kind)) }));

        const error = await api.projects().catch((reason: unknown) => reason);

        expect(error).toBeInstanceOf(ApiError);
        expect(error).toHaveProperty('message', message);
    });

    it('сохраняет код OAuth при входе', async () => {
        const core = createPluginCore(
            createKotlin({ completeLogin: vi.fn().mockRejectedValue(failure('oauth', 'access_denied')) }),
        );

        const error = await core.completeLogin(new AbortController().signal).catch((reason: unknown) => reason);

        expect(error).toBeInstanceOf(OAuthError);
        expect(error).toHaveProperty('code', 'access_denied');
    });

    it('отличает сбой хранилища и передаёт его причину', async () => {
        const core = createPluginCore(
            createKotlin({ restore: vi.fn().mockRejectedValue(failure('storage', 'storage is broken')) }),
        );

        const error = await core.restore().catch((reason: unknown) => reason);

        expect(error).toBeInstanceOf(StorageError);
        expect(error).toHaveProperty('message', 'storage is broken');
    });

    it('оповещает подписчиков о потере сессии и даёт отписаться', () => {
        const kotlin = createKotlin();
        const core = createPluginCore(kotlin);
        const listener = vi.fn();
        const unsubscribe = core.onExpired(listener);
        const expire = vi.mocked(kotlin.onSessionExpired).mock.calls[0][0];

        expire();
        unsubscribe();
        expire();

        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('отдаёт байты файла шрифта и называет отказ без упоминания сервера DS Builder', async () => {
        const fontFile = vi
            .fn<KotlinCore['fontFile']>()
            .mockResolvedValueOnce(new Int8Array([79, 84, 84, 79]))
            .mockRejectedValueOnce(failure('file', '404'))
            .mockRejectedValueOnce(failure('network'));
        const { api } = createPluginCore(createKotlin({ fontFile }));

        expect(new TextDecoder().decode(await api.fontFile('https://cdn/Font.otf'))).toBe('OTTO');
        await expect(api.fontFile('https://cdn/Missing.otf')).rejects.toThrow('ответ 404');
        await expect(api.fontFile('https://cdn/Font.otf')).rejects.toThrow('файл недоступен');
    });
});
