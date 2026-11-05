import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { StorageKey } from '../../shared/messages';
import { App } from '../App';
import { ApiError } from '../api/httpClient';
import type { DsBuilderApi } from '../api/dsBuilderApi';
import { OAuthError, TransportError, type AuthEndpoints } from '../auth/authEndpoints';
import type { PluginBridge } from '../bridge';
import type { TokenSnapshot } from '../tokens/snapshot';
import { automaticChoice, defaultVersionId, parseSavedContext } from './contextSteps';

const snapshot = (name = 'text.default.accent'): TokenSnapshot => ({
    colors: [
        {
            id: 'c1',
            name,
            label: 'Accent',
            group: 'text',
            light: { kind: 'color', css: '#000000' },
            dark: { kind: 'color', css: '#ffffff' },
        },
        {
            id: 'c2',
            name: 'surface.default.solid',
            label: 'Solid',
            group: 'surface',
            light: { kind: 'unknown', raw: '"[x]"' },
            dark: { kind: 'empty' },
        },
    ],
    typography: [
        {
            screen: 'screen-l',
            styles: [
                {
                    id: 't1',
                    name: 'body.m',
                    label: 'M',
                    group: 'body',
                    sizePx: 16,
                    lineHeightPx: 20,
                    letterSpacingEm: 0,
                    weights: [400, 600],
                    fontName: 'SB Sans Text',
                },
            ],
        },
    ],
    radii: [{ id: 'r1', name: 'round.m', valuePx: 8, fullRounding: false }],
    spacing: [{ id: 's1', name: 'spacing.4x', valuePx: 16, fullRounding: false }],
    shadows: [{ id: 'h1', name: 'card', layers: [{ offsetX: 0, offsetY: 2, blur: 4, spread: 0, color: '#00000033' }] }],
});

const createApi = (overrides: Partial<DsBuilderApi> = {}) =>
    ({
        projects: vi.fn(async () => [{ id: 'p1', name: 'Project' }]),
        designSystems: vi.fn(async () => [{ id: 'd1', name: 'Base' }]),
        tenants: vi.fn(async () => [
            { id: 't1', name: 'Default' },
            { id: 't2', name: 'Dark brand' },
        ]),
        versions: vi.fn(async () => [
            { id: 'v1', version: '1.0.0', sequenceNumber: 1, publishedAt: '2026-01-01' },
            { id: 'v2', version: '1.1.0', sequenceNumber: 2, publishedAt: '2026-02-01' },
        ]),
        snapshot: vi.fn(async () => snapshot()),
        ...overrides,
    }) as unknown as DsBuilderApi;

const createBridge = (initial: Partial<Record<StorageKey, string>> = { 'refresh-token': 'saved' }) => {
    const values = new Map(Object.entries(initial));
    const bridge: PluginBridge = {
        get: async (key) => values.get(key) ?? null,
        set: async (key, value) => void values.set(key, value),
        delete: async (key) => void values.delete(key),
        openExternal: vi.fn(),
    };
    return { bridge, values };
};

const createEndpoints = (overrides: Partial<AuthEndpoints> = {}): AuthEndpoints => ({
    requestDeviceCode: vi.fn(async () => ({
        deviceCode: 'device',
        userCode: 'ABCD-EFGH',
        verificationUri: 'https://example.test/device?user_code=ABCD-EFGH',
        intervalSeconds: 0,
        expiresInSeconds: 600,
    })),
    exchangeDeviceCode: vi.fn(async () => ({ accessToken: 'access', refreshToken: 'new-refresh' })),
    refresh: vi.fn(async () => ({ accessToken: 'access', refreshToken: 'rotated' })),
    logout: vi.fn(async () => undefined),
    ...overrides,
});

const mount = (options: { api?: DsBuilderApi; bridge?: PluginBridge; endpoints?: AuthEndpoints } = {}) => {
    const api = options.api ?? createApi();
    const bridge = options.bridge ?? createBridge().bridge;
    const endpoints = options.endpoints ?? createEndpoints();
    const view = render(<App bridge={bridge} endpoints={endpoints} createApi={() => api} />);
    return { api, bridge, endpoints, view };
};

const chooseTenant = async () => fireEvent.click(await screen.findByRole('button', { name: 'Default' }));

describe('вход', () => {
    it('открывает браузер, показывает код и после подтверждения переходит к выбору', async () => {
        const { bridge, values } = createBridge({});
        mount({ bridge });

        fireEvent.click(await screen.findByRole('button', { name: 'Войти' }));

        await waitFor(() =>
            expect(bridge.openExternal).toHaveBeenCalledWith('https://example.test/device?user_code=ABCD-EFGH'),
        );
        expect(await screen.findByRole('heading', { name: 'Тема' })).toBeInTheDocument();
        expect(values.get('refresh-token')).toBe('new-refresh');
    });

    it('показывает код устройства, пока ждёт подтверждения, и даёт отменить вход', async () => {
        const endpoints = createEndpoints({
            exchangeDeviceCode: vi.fn(async () => {
                throw new OAuthError('authorization_pending');
            }),
        });
        const { bridge } = createBridge({});
        mount({ bridge, endpoints });

        fireEvent.click(await screen.findByRole('button', { name: 'Войти' }));

        expect(await screen.findByTestId('user-code')).toHaveTextContent('ABCD-EFGH');
        fireEvent.click(screen.getByRole('button', { name: 'Открыть снова' }));
        expect(bridge.openExternal).toHaveBeenCalledTimes(2);
        fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
        expect(await screen.findByRole('button', { name: 'Войти' })).toBeInTheDocument();
    });

    it('при сбое хранилища называет причину и не винит сервер', async () => {
        const { bridge } = createBridge({});
        mount({ bridge: { ...bridge, get: vi.fn().mockRejectedValue(new Error('storage is broken')) } });

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('storage is broken');
        expect(alert).not.toHaveTextContent('Сервер DS Builder недоступен');
    });

    it('если вход некуда сохранить, сообщает об этом и завершает сессию на сервере', async () => {
        const { bridge } = createBridge({});
        const endpoints = createEndpoints();
        mount({ bridge: { ...bridge, set: vi.fn().mockRejectedValue(new Error('full')) }, endpoints });

        fireEvent.click(await screen.findByRole('button', { name: 'Войти' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось сохранить вход');
        expect(endpoints.logout).toHaveBeenCalled();
    });

    it('при сетевом сбое обновления сообщает о недоступном сервере', async () => {
        const refresh = vi.fn().mockRejectedValue(new TransportError('offline'));
        mount({ endpoints: createEndpoints({ refresh }) });

        expect(await screen.findByRole('alert')).toHaveTextContent(/^Сервер DS Builder недоступен\.Повторить$/);
    });

    it('прекращает опрос при закрытии окна', async () => {
        const exchangeDeviceCode = vi.fn(async () => {
            throw new OAuthError('authorization_pending');
        });
        const { view } = mount({ bridge: createBridge({}).bridge, endpoints: createEndpoints({ exchangeDeviceCode }) });
        fireEvent.click(await screen.findByRole('button', { name: 'Войти' }));
        await screen.findByTestId('user-code');
        await waitFor(() => expect(exchangeDeviceCode).toHaveBeenCalled());

        view.unmount();
        const calls = exchangeDeviceCode.mock.calls.length;
        await new Promise((resolve) => setTimeout(resolve, 20));

        expect(exchangeDeviceCode).toHaveBeenCalledTimes(calls);
    });

    it('при `not_allowed` направляет к администратору', async () => {
        const endpoints = createEndpoints({
            exchangeDeviceCode: vi.fn(async () => {
                throw new OAuthError('not_allowed');
            }),
        });
        mount({ bridge: createBridge({}).bridge, endpoints });

        fireEvent.click(await screen.findByRole('button', { name: 'Войти' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Обратитесь к администратору');
    });

    it('показывает причину и «Войти снова», если вход отклонён', async () => {
        const endpoints = createEndpoints({
            exchangeDeviceCode: vi.fn(async () => {
                throw new OAuthError('access_denied');
            }),
        });
        mount({ bridge: createBridge({}).bridge, endpoints });

        fireEvent.click(await screen.findByRole('button', { name: 'Войти' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Вход отклонён');
        expect(screen.getByRole('button', { name: 'Войти снова' })).toBeInTheDocument();
    });

    it('не открывает браузер при повторном запуске с сохранённым входом', async () => {
        const { bridge } = mount();

        expect(await screen.findByRole('heading', { name: 'Тема' })).toBeInTheDocument();
        expect(bridge.openExternal).not.toHaveBeenCalled();
    });

    it('при недоступном сервере не теряет вход и предлагает повторить', async () => {
        const refresh = vi.fn(async () => ({ accessToken: 'access', refreshToken: 'rotated' }));
        refresh.mockRejectedValueOnce(new TransportError('offline'));
        const { bridge, values } = createBridge();
        mount({ bridge, endpoints: createEndpoints({ refresh }) });

        fireEvent.click(await screen.findByRole('button', { name: 'Повторить' }));

        expect(await screen.findByRole('heading', { name: 'Тема' })).toBeInTheDocument();
        expect(values.has('refresh-token')).toBe(true);
    });

    it('выход не ждёт зависшего сервера', async () => {
        const endpoints = createEndpoints({ logout: vi.fn(() => new Promise<void>(() => undefined)) });
        mount({ endpoints });

        fireEvent.click(await screen.findByRole('button', { name: 'Выйти' }));

        expect(await screen.findByRole('button', { name: 'Войти' })).toBeInTheDocument();
    });

    it('выход очищает токен и возвращает на экран входа', async () => {
        const { bridge, values } = createBridge();
        const { endpoints } = mount({ bridge });

        fireEvent.click(await screen.findByRole('button', { name: 'Выйти' }));

        expect(await screen.findByRole('button', { name: 'Войти' })).toBeInTheDocument();
        expect(values.has('refresh-token')).toBe(false);
        await waitFor(() => expect(endpoints.logout).toHaveBeenCalledWith('rotated'));
    });
});

describe('выбор контекста', () => {
    it('пропускает шаги с единственным вариантом, оставляя их в хлебных крошках', async () => {
        mount();

        expect(await screen.findByRole('heading', { name: 'Тема' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Project' })).toBeEnabled();
    });

    it('крошка дизайн-системы открывает её темы, а текущая тема не нажимается', async () => {
        mount();
        await chooseTenant();

        const tenant = await screen.findByRole('button', { name: 'Default' });
        expect(tenant).toBeDisabled();
        expect(tenant).toHaveAttribute('aria-current', 'page');
        fireEvent.click(screen.getByRole('button', { name: 'Base' }));

        expect(await screen.findByRole('heading', { name: 'Тема' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Base' })).toBeDisabled();
    });

    it('родительские крошки открывают свой уровень, даже если вариант на нём один', async () => {
        mount();
        await chooseTenant();

        fireEvent.click(await screen.findByRole('button', { name: 'Project' }));
        expect(await screen.findByRole('heading', { name: 'Дизайн-система' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Project' })).toBeDisabled();

        fireEvent.click(screen.getByRole('button', { name: 'Проекты' }));
        expect(await screen.findByRole('heading', { name: 'Проект' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Проекты' })).toBeDisabled();
    });

    it('после выбора на открытом шаге следующий единственный вариант снова пропускается', async () => {
        mount();
        await chooseTenant();
        fireEvent.click(await screen.findByRole('button', { name: 'Проекты' }));

        fireEvent.click(within(await screen.findByRole('list')).getByRole('button', { name: 'Project' }));

        expect(await screen.findByRole('heading', { name: 'Тема' })).toBeInTheDocument();
    });

    it('возврат на проект сбрасывает следующие шаги, а единственный вариант снова пропускается', async () => {
        const api = createApi({
            projects: vi.fn(async () => [
                { id: 'p1', name: 'First' },
                { id: 'p2', name: 'Second' },
            ]),
        });
        mount({ api });
        fireEvent.click(await screen.findByRole('button', { name: 'First' }));
        await chooseTenant();

        fireEvent.click(await screen.findByRole('button', { name: 'Проекты' }));
        expect(await screen.findByRole('heading', { name: 'Проект' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Base' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Second' }));

        expect(await screen.findByRole('heading', { name: 'Тема' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Base' })).toBeDisabled();
    });

    it('при `403` на шаге сообщает об отказе и не выбирает вариант заново', async () => {
        const denied = vi.fn(async () => {
            throw new ApiError('forbidden', 'Нет доступа');
        });
        mount({ api: createApi({ designSystems: denied }) });

        expect(await screen.findByText('Нет доступа к этому проекту.')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Проект' })).toBeInTheDocument();
        expect(denied).toHaveBeenCalledTimes(1);
    });

    it('запоминает контекст и открывает его при следующем запуске', async () => {
        const { bridge, values } = createBridge();
        mount({ bridge });
        await chooseTenant();
        await waitFor(() => expect(values.get('context')).toContain('"tenantId":"t1"'));

        cleanup();

        const context = values.get('context');
        const { bridge: next } = createBridge({ 'refresh-token': 'saved', context });
        mount({ bridge: next });

        expect(await screen.findByRole('tab', { name: 'Цвета' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Тема' })).toBeNull();
    });

    it('если запомненная тема недоступна, показывает выбор темы без ошибки', async () => {
        const context = JSON.stringify({ projectId: 'p1', designSystemId: 'd1', tenantId: 'gone' });
        mount({ bridge: createBridge({ 'refresh-token': 'saved', context }).bridge });

        expect(await screen.findByRole('heading', { name: 'Тема' })).toBeInTheDocument();
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('сообщает, что нет доступных проектов', async () => {
        mount({ api: createApi({ projects: vi.fn(async () => []) }) });

        expect(await screen.findByText('Нет доступных проектов.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Выйти' })).toBeInTheDocument();
    });

    it('показывает ошибку загрузки и повторяет чтение', async () => {
        const projects = vi.fn(async () => [{ id: 'p1', name: 'Project' }]);
        projects.mockRejectedValueOnce(new ApiError('network', 'Сервер DS Builder недоступен'));
        mount({ api: createApi({ projects }) });

        fireEvent.click(await screen.findByRole('button', { name: 'Повторить' }));

        expect(await screen.findByRole('heading', { name: 'Тема' })).toBeInTheDocument();
    });
});

describe('просмотр токенов', () => {
    it('по умолчанию читает последнюю опубликованную версию', async () => {
        const { api } = mount();
        await chooseTenant();

        await screen.findByText('Accent');

        expect(api.snapshot).toHaveBeenCalledWith(
            { projectId: 'p1', designSystemId: 'd1', tenantId: 't1' },
            'v2',
            expect.anything(),
        );
        expect(screen.getByRole('combobox', { name: 'Версия' })).toHaveValue('v2');
        expect(screen.queryByTestId('draft-note')).toBeNull();
    });

    it('читает черновик без `versionId` и показывает пометку', async () => {
        const { api } = mount();
        await chooseTenant();
        await screen.findByText('Accent');

        fireEvent.change(screen.getByRole('combobox', { name: 'Версия' }), { target: { value: 'draft' } });

        await waitFor(() => expect(api.snapshot).toHaveBeenLastCalledWith(expect.anything(), null, expect.anything()));
        expect(await screen.findByTestId('draft-note')).toBeInTheDocument();
    });

    it('без опубликованных версий открывает черновик', async () => {
        const { api } = mount({ api: createApi({ versions: vi.fn(async () => []) }) });
        await chooseTenant();

        await screen.findByText('Accent');

        expect(api.snapshot).toHaveBeenCalledWith(expect.anything(), null, expect.anything());
    });

    it('показывает разделы и режимы', async () => {
        mount();
        await chooseTenant();

        expect(await screen.findByText('#000000')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
        expect(screen.getByText('#ffffff')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: 'Типографика' }));
        expect(screen.getByText('16/20 · 400, 600 · SB Sans Text')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: 'Размеры' }));
        expect(screen.getByText('8 px')).toBeInTheDocument();
        expect(screen.getByText('16 px')).toBeInTheDocument();
        expect(screen.getByText('0 2 4 0 #00000033')).toBeInTheDocument();
    });

    it('показывает неразобранное значение и остальные токены', async () => {
        mount();
        await chooseTenant();

        expect(await screen.findByText('Не разобрано: "[x]"')).toBeInTheDocument();
        expect(screen.getByText('Accent')).toBeInTheDocument();
    });

    it('ищет токены и сообщает, если ничего не нашлось', async () => {
        mount();
        await chooseTenant();
        await screen.findByText('Accent');
        const search = screen.getByRole('searchbox', { name: 'Найти токен' });

        fireEvent.change(search, { target: { value: 'SOLID' } });
        expect(screen.queryByText('Accent')).toBeNull();
        expect(screen.getByText('Solid')).toBeInTheDocument();

        fireEvent.change(search, { target: { value: 'нет такого' } });
        expect(screen.getByText('Ничего не найдено.')).toBeInTheDocument();
    });

    it('не показывает ответ устаревшего чтения', async () => {
        const reads: Array<(value: TokenSnapshot) => void> = [];
        const read = vi.fn(() => new Promise<TokenSnapshot>((resolve) => reads.push(resolve)));
        mount({ api: createApi({ snapshot: read }) });
        await chooseTenant();
        await waitFor(() => expect(read).toHaveBeenCalledTimes(1));

        fireEvent.change(await screen.findByRole('combobox', { name: 'Версия' }), { target: { value: 'v1' } });
        await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
        expect((read.mock.calls[0] as unknown[])[2]).toMatchObject({ aborted: true });
        await act(async () => reads[0]({ ...snapshot(), colors: [] }));
        expect(screen.getByRole('status')).toHaveTextContent('Загружаем токены');

        await act(async () => reads[1](snapshot()));
        expect(screen.getByText('Accent')).toBeInTheDocument();
    });

    it('при `403` сообщает об отказе и возвращает к выбору темы', async () => {
        mount({
            api: createApi({
                snapshot: vi.fn(async () => {
                    throw new ApiError('forbidden', 'Нет доступа');
                }),
            }),
        });
        await chooseTenant();

        expect(await screen.findByText('Нет доступа к этой теме.')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Тема' })).toBeInTheDocument();
    });

    it('при `403` с единственной темой не возвращается к ней сама', async () => {
        const read = vi.fn(async () => {
            throw new ApiError('forbidden', 'Нет доступа');
        });
        mount({ api: createApi({ snapshot: read, tenants: vi.fn(async () => [{ id: 't1', name: 'Default' }]) }) });

        expect(await screen.findByText('Нет доступа к этой теме.')).toBeInTheDocument();
        expect(read).toHaveBeenCalledTimes(1);
    });

    it('убирает сообщение об отказе после выбора другой темы', async () => {
        const read = vi.fn(async () => snapshot());
        read.mockRejectedValueOnce(new ApiError('forbidden', 'Нет доступа'));
        mount({ api: createApi({ snapshot: read }) });
        await chooseTenant();
        await screen.findByText('Нет доступа к этой теме.');

        fireEvent.click(screen.getByRole('button', { name: 'Dark brand' }));

        expect(await screen.findByText('Accent')).toBeInTheDocument();
        expect(screen.queryByText('Нет доступа к этой теме.')).toBeNull();
    });

    it('если темы нет в версии, говорит об этом и оставляет выбор версии', async () => {
        const read = vi.fn(async () => snapshot());
        read.mockRejectedValueOnce(new ApiError('not-found', 'Данные не найдены'));
        mount({ api: createApi({ snapshot: read }) });
        await chooseTenant();

        expect(await screen.findByText('Этой темы нет в выбранной версии.')).toBeInTheDocument();
        fireEvent.change(screen.getByRole('combobox', { name: 'Версия' }), { target: { value: 'draft' } });

        expect(await screen.findByText('Accent')).toBeInTheDocument();
    });

    it('показывает ошибку чтения с «Повторить»', async () => {
        const read = vi.fn(async () => snapshot());
        read.mockRejectedValueOnce(new ApiError('server', 'Сервер DS Builder ответил ошибкой'));
        mount({ api: createApi({ snapshot: read }) });
        await chooseTenant();

        fireEvent.click(await screen.findByRole('button', { name: 'Повторить' }));

        expect(await screen.findByText('Accent')).toBeInTheDocument();
    });
});

describe('правила шагов', () => {
    const items = [{ id: 'a' }, { id: 'b' }];

    it('выбирает запомненный или единственный вариант', () => {
        expect(automaticChoice(items, 'b')).toEqual({ id: 'b' });
        expect(automaticChoice(items, 'gone')).toBeNull();
        expect(automaticChoice([{ id: 'a' }], 'gone')).toEqual({ id: 'a' });
    });

    it('не считает неопубликованную запись версией по умолчанию', () => {
        expect(defaultVersionId([{ id: 'draft', version: '', sequenceNumber: 3, publishedAt: null }])).toBeNull();
    });

    it('игнорирует повреждённый запомненный контекст', () => {
        expect(parseSavedContext('{oops')).toEqual({});
        expect(parseSavedContext(null)).toEqual({});
    });
});
