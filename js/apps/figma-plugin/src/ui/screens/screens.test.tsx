import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { zip, type ArchiveFile } from '../../shared/zip';
import type { ExportCounts, ExportPlan, ExportReport } from '../../shared/exportPlan';
import type { StorageKey } from '../../shared/messages';
import { App } from '../App';
import type { PluginBridge } from '../bridge';
import { ApiError, OAuthError, StorageError, type DsBuilderApi, type PluginCore } from '../core/pluginCore';
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

const exportPlan = { collections: [], skipped: [] } as unknown as ExportPlan;

const counts = (variables = 0): ExportCounts => ({
    collections: 0,
    variables,
    textStyles: 0,
    effectStyles: 0,
    paintStyles: 0,
});

const exportReport = (overrides: Partial<ExportReport> = {}): ExportReport => ({
    source: { themeName: 'Default', tenantId: 't1', versionId: 'v2' },
    created: counts(12),
    updated: counts(3),
    stale: counts(1),
    skipped: [{ name: 'Header/H1 B', reason: 'шрифт не найден' }],
    omitted: { disabled: 2 },
    notes: [],
    missingFonts: [],
    fontFiles: [],
    ...overrides,
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
        exportPlan: vi.fn(async () => exportPlan),
        ...overrides,
    }) as unknown as DsBuilderApi;

const createBridge = (initial: Partial<Record<StorageKey, string>> = { 'refresh-token': 'saved' }) => {
    const values = new Map(Object.entries(initial));
    const bridge: PluginBridge = {
        get: async (key) => values.get(key) ?? null,
        set: async (key, value) => void values.set(key, value),
        delete: async (key) => void values.delete(key),
        openExternal: vi.fn(),
        applyExport: vi.fn(async () => exportReport()),
        packZip: vi.fn(async (files: ArchiveFile[]) => zip(files)),
    };
    return { bridge, values };
};

const createCore = (api: DsBuilderApi, overrides: Partial<PluginCore> = {}): PluginCore => ({
    api,
    restore: vi.fn(async () => true),
    startLogin: vi.fn(async () => ({
        userCode: 'ABCD-EFGH',
        verificationUri: 'https://example.test/device?user_code=ABCD-EFGH',
    })),
    completeLogin: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
    onExpired: vi.fn(() => () => undefined),
    ...overrides,
});

const signedOut = { restore: vi.fn(async () => false) };

/** Вход не подтверждён: опрос идёт, пока его не отменят. */
const pendingLogin = (signal: AbortSignal) =>
    new Promise<void>((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));

const mount = (options: { api?: DsBuilderApi; bridge?: PluginBridge; core?: Partial<PluginCore> } = {}) => {
    const api = options.api ?? createApi();
    const bridge = options.bridge ?? createBridge().bridge;
    const core = createCore(api, options.core);
    const view = render(<App bridge={bridge} core={core} />);
    return { api, bridge, core, view };
};

const chooseTenant = async () => fireEvent.click(await screen.findByRole('button', { name: 'Default' }));

describe('вход', () => {
    it('открывает браузер, показывает код и после подтверждения переходит к выбору', async () => {
        const { bridge, core } = mount({ core: signedOut });

        fireEvent.click(await screen.findByRole('button', { name: 'Войти' }));

        await waitFor(() =>
            expect(bridge.openExternal).toHaveBeenCalledWith('https://example.test/device?user_code=ABCD-EFGH'),
        );
        expect(await screen.findByRole('heading', { name: 'Тема' })).toBeInTheDocument();
        expect(core.completeLogin).toHaveBeenCalled();
    });

    it('показывает код устройства, пока ждёт подтверждения, и даёт отменить вход', async () => {
        const { bridge } = mount({ core: { ...signedOut, completeLogin: pendingLogin } });

        fireEvent.click(await screen.findByRole('button', { name: 'Войти' }));

        expect(await screen.findByTestId('user-code')).toHaveTextContent('ABCD-EFGH');
        fireEvent.click(screen.getByRole('button', { name: 'Открыть снова' }));
        expect(bridge.openExternal).toHaveBeenCalledTimes(2);
        fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
        expect(await screen.findByRole('button', { name: 'Войти' })).toBeInTheDocument();
    });

    it('при сбое хранилища называет причину и не винит сервер', async () => {
        mount({ core: { restore: vi.fn().mockRejectedValue(new StorageError('storage is broken')) } });

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('storage is broken');
        expect(alert).not.toHaveTextContent('Сервер DS Builder недоступен');
    });

    it('если вход некуда сохранить, сообщает об этом', async () => {
        mount({ core: { ...signedOut, completeLogin: vi.fn().mockRejectedValue(new StorageError('full')) } });

        fireEvent.click(await screen.findByRole('button', { name: 'Войти' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось сохранить вход');
    });

    it('при сетевом сбое обновления сообщает о недоступном сервере', async () => {
        mount({ core: { restore: vi.fn().mockRejectedValue(new ApiError('network')) } });

        expect(await screen.findByRole('alert')).toHaveTextContent(/^Сервер DS Builder недоступен\.Повторить$/);
    });

    it('отменяет опрос при закрытии окна', async () => {
        const completeLogin = vi.fn(pendingLogin);
        const { view } = mount({ core: { ...signedOut, completeLogin } });
        fireEvent.click(await screen.findByRole('button', { name: 'Войти' }));
        await screen.findByTestId('user-code');

        view.unmount();

        expect(completeLogin.mock.calls[0][0].aborted).toBe(true);
    });

    it('при `not_allowed` направляет к администратору', async () => {
        mount({ core: { ...signedOut, completeLogin: vi.fn().mockRejectedValue(new OAuthError('not_allowed')) } });

        fireEvent.click(await screen.findByRole('button', { name: 'Войти' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Обратитесь к администратору');
    });

    it('показывает причину и «Войти снова», если вход отклонён', async () => {
        mount({ core: { ...signedOut, completeLogin: vi.fn().mockRejectedValue(new OAuthError('access_denied')) } });

        fireEvent.click(await screen.findByRole('button', { name: 'Войти' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Вход отклонён');
        expect(screen.getByRole('button', { name: 'Войти снова' })).toBeInTheDocument();
    });

    it('не открывает браузер при повторном запуске с сохранённым входом', async () => {
        const { bridge } = mount();

        expect(await screen.findByRole('heading', { name: 'Тема' })).toBeInTheDocument();
        expect(bridge.openExternal).not.toHaveBeenCalled();
    });

    it('при недоступном сервере предлагает повторить', async () => {
        const restore = vi.fn(async () => true);
        restore.mockRejectedValueOnce(new ApiError('network'));
        mount({ core: { restore } });

        fireEvent.click(await screen.findByRole('button', { name: 'Повторить' }));

        expect(await screen.findByRole('heading', { name: 'Тема' })).toBeInTheDocument();
    });

    it('выход не ждёт зависшего сервера', async () => {
        const { core } = mount({ core: { signOut: vi.fn(() => new Promise<void>(() => undefined)) } });

        fireEvent.click(await screen.findByRole('button', { name: 'Выйти' }));

        expect(await screen.findByRole('button', { name: 'Войти' })).toBeInTheDocument();
        expect(core.signOut).toHaveBeenCalled();
    });

    it('возвращает на экран входа при потере сессии', async () => {
        let expire = () => {};
        const onExpired = (listener: () => void) => {
            expire = listener;
            return () => undefined;
        };
        mount({ core: { onExpired } });
        await screen.findByRole('heading', { name: 'Тема' });

        act(() => expire());

        expect(await screen.findByRole('button', { name: 'Войти' })).toBeInTheDocument();
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
        expect(screen.getByText('16/20').closest('li')).toHaveTextContent('16/20 · 400, 600 · SB Sans Text');

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

describe('экспорт в Figma', () => {
    it('строит план выбранной темы и версии, записывает его и показывает отчёт', async () => {
        const { api, bridge } = mount();
        await chooseTenant();
        await screen.findByText('Accent');

        fireEvent.click(screen.getByRole('button', { name: 'Экспортировать в Figma' }));

        const report = await screen.findByTestId('export-report');
        expect(api.exportPlan).toHaveBeenCalledWith(
            { projectId: 'p1', designSystemId: 'd1', tenantId: 't1' },
            'v2',
            'Default',
            'web',
        );
        expect(bridge.applyExport).toHaveBeenCalledWith(exportPlan);
        expect(report).toHaveTextContent('Тема «Default», версия 1.1.0, Web');
        const row = within(report).getByRole('row', { name: /Переменные/ });
        expect(row).toHaveTextContent('Переменные1231');
        expect(report).toHaveTextContent('Выключенные в DS Builder токены не экспортируются: 2.');
        expect(screen.queryByTestId('missing-fonts')).toBeNull();
        expect(report).toHaveTextContent('шрифт не найден · 1Header/H1 B');
        fireEvent.click(within(report).getByRole('button', { name: 'Скрыть' }));
        expect(screen.queryByTestId('export-report')).toBeNull();
    });

    it('подсказывает установить недостающие шрифты', async () => {
        const { bridge } = mount();
        vi.mocked(bridge.applyExport).mockResolvedValueOnce(exportReport({ missingFonts: ['SB Sans Display'] }));
        await chooseTenant();
        await screen.findByText('Accent');

        fireEvent.click(screen.getByRole('button', { name: 'Экспортировать в Figma' }));

        expect(await screen.findByTestId('missing-fonts')).toHaveTextContent(
            'Не найдены шрифты: SB Sans Display. Установите их на компьютер и повторите экспорт',
        );
        expect(screen.queryByTestId('font-files')).toBeNull();
    });

    it('показывает созданное с оговоркой отдельно от пропусков', async () => {
        const { bridge } = mount();
        const reason = 'градиент описан парой стилей Light и Dark: в режимах разное число слоёв';
        vi.mocked(bridge.applyExport).mockResolvedValueOnce(
            exportReport({ notes: [{ name: 'surface.default.card', reason }] }),
        );
        await chooseTenant();
        await screen.findByText('Accent');

        fireEvent.click(screen.getByRole('button', { name: 'Экспортировать в Figma' }));

        const notes = await screen.findByTestId('export-notes');
        expect(notes).toHaveTextContent('Создано с оговоркой: 1');
        expect(notes).toHaveTextContent(reason);
        expect(screen.getByTestId('export-skipped')).toHaveTextContent('Пропущено: 1');
    });

    const missingFontReport = () =>
        exportReport({
            missingFonts: ['SB Sans Display'],
            fontFiles: [
                {
                    family: 'SB Sans Display',
                    files: [
                        { name: 'SBSansDisplay-Bold.otf', url: 'https://cdn.example/SBSansDisplay-Bold.otf' },
                        { name: 'SBSansDisplay-Light.otf', url: 'https://cdn.example/SBSansDisplay-Light.otf' },
                    ],
                },
            ],
        });

    it('скачивает недостающие шрифты одним архивом по кнопке', async () => {
        const fontFile = vi.fn(async (url: string) => new TextEncoder().encode(url));
        const { bridge } = mount({ api: createApi({ fontFile }) });
        const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:fonts');
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
        Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
        vi.mocked(bridge.applyExport).mockResolvedValueOnce(missingFontReport());
        await chooseTenant();
        await screen.findByText('Accent');
        fireEvent.click(screen.getByRole('button', { name: 'Экспортировать в Figma' }));
        const files = await screen.findByTestId('font-files');
        expect(within(files).queryByText('SBSansDisplay-Bold.otf')).toBeNull();

        fireEvent.click(within(files).getByRole('button', { name: 'Скачать шрифты одним архивом (ZIP)' }));

        await waitFor(() =>
            expect(within(files).getByRole('status')).toHaveTextContent('Архив dsbuilder-fonts.zip в загрузках'),
        );
        expect(fontFile).toHaveBeenCalledTimes(2);
        expect(vi.mocked(bridge.packZip).mock.calls[0][0].map((file) => file.path)).toEqual([
            'SB Sans Display/SBSansDisplay-Bold.otf',
            'SB Sans Display/SBSansDisplay-Light.otf',
        ]);
        expect(createObjectURL.mock.calls[0][0].type).toBe('application/zip');
        expect(click).toHaveBeenCalledTimes(1);
        click.mockRestore();
    });

    it('при сбое скачивания называет файл и разрешает повторить', async () => {
        const fontFile = vi.fn(async (url: string) => {
            if (url.endsWith('Light.otf')) throw new Error('ответ 404');
            return new Uint8Array([1]);
        });
        const { bridge } = mount({ api: createApi({ fontFile }) });
        vi.mocked(bridge.applyExport).mockResolvedValueOnce(missingFontReport());
        await chooseTenant();
        await screen.findByText('Accent');
        fireEvent.click(screen.getByRole('button', { name: 'Экспортировать в Figma' }));
        const files = await screen.findByTestId('font-files');

        fireEvent.click(within(files).getByRole('button', { name: 'Скачать шрифты одним архивом (ZIP)' }));

        await waitFor(() =>
            expect(within(files).getByRole('status')).toHaveTextContent(
                'Не удалось скачать: SBSansDisplay-Light.otf (ответ 404)',
            ),
        );
        expect(bridge.packZip).not.toHaveBeenCalled();
        expect(within(files).getByRole('button', { name: 'Скачать шрифты одним архивом (ZIP)' })).toBeEnabled();
    });

    it('экспортирует значения выбранной платформы', async () => {
        const { api, bridge } = mount();
        vi.mocked(bridge.applyExport).mockResolvedValueOnce(
            exportReport({ source: { themeName: 'Default', tenantId: 't1', versionId: 'v2', platform: 'ios' } }),
        );
        await chooseTenant();
        await screen.findByText('Accent');
        const platforms = screen.getByRole('group', { name: 'Платформа' });
        expect(within(platforms).getByRole('button', { name: 'Web' })).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(within(platforms).getByRole('button', { name: 'iOS' }));
        fireEvent.click(screen.getByRole('button', { name: 'Экспортировать в Figma' }));

        expect(await screen.findByTestId('export-report')).toHaveTextContent('версия 1.1.0, iOS');
        expect(api.exportPlan).toHaveBeenCalledWith(expect.anything(), 'v2', 'Default', 'ios');
    });

    it('экспортирует черновик без `versionId`', async () => {
        const { api } = mount();
        await chooseTenant();
        await screen.findByText('Accent');
        fireEvent.change(screen.getByRole('combobox', { name: 'Версия' }), { target: { value: 'draft' } });

        fireEvent.click(screen.getByRole('button', { name: 'Экспортировать в Figma' }));

        await waitFor(() => expect(api.exportPlan).toHaveBeenCalledWith(expect.anything(), null, 'Default', 'web'));
        expect(await screen.findByTestId('export-report')).toHaveTextContent('черновик');
    });

    it('при ошибке чтения не трогает файл и даёт повторить', async () => {
        const plan = vi.fn(async () => exportPlan);
        plan.mockRejectedValueOnce(new ApiError('server', 'Сервер DS Builder ответил ошибкой'));
        const { bridge } = mount({ api: createApi({ exportPlan: plan }) });
        await chooseTenant();
        await screen.findByText('Accent');

        fireEvent.click(screen.getByRole('button', { name: 'Экспортировать в Figma' }));

        expect(
            await screen.findByText('Не удалось экспортировать: Сервер DS Builder ответил ошибкой'),
        ).toBeInTheDocument();
        expect(bridge.applyExport).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
        expect(await screen.findByTestId('export-report')).toBeInTheDocument();
    });

    it('не даёт запустить экспорт второй раз, пока идёт первый, и показывает причину остановки', async () => {
        let finish: (report: ExportReport) => void = () => undefined;
        const { bridge } = mount();
        vi.mocked(bridge.applyExport).mockImplementationOnce(
            () => new Promise<ExportReport>((resolve) => (finish = resolve)),
        );
        await chooseTenant();
        await screen.findByText('Accent');

        fireEvent.click(screen.getByRole('button', { name: 'Экспортировать в Figma' }));

        const running = await screen.findByRole('button', { name: 'Экспортируем…' });
        expect(running).toBeDisabled();
        expect(screen.getByRole('combobox', { name: 'Версия' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Выйти' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Base' })).toBeDisabled();
        await act(async () => finish(exportReport({ failure: 'Число режимов ограничено тарифом файла.' })));
        expect(await screen.findByRole('alert')).toHaveTextContent('Экспорт прерван: Число режимов ограничено тарифом');
        expect(bridge.applyExport).toHaveBeenCalledTimes(1);
    });
});

describe('копирование из просмотра', () => {
    const copied: string[] = [];
    afterEach(() => {
        vi.unstubAllGlobals();
        Reflect.deleteProperty(document, 'execCommand');
    });
    const stubCopy = (works: boolean) => {
        copied.length = 0;
        Object.defineProperty(document, 'execCommand', {
            configurable: true,
            value: vi.fn(() => {
                if (works) copied.push(document.querySelector<HTMLTextAreaElement>('textarea[readonly]')?.value ?? '');
                return works;
            }),
        });
        vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    };

    it('копирует HEX, имя и значения типографики и показывает подтверждение', async () => {
        stubCopy(true);
        mount();
        await chooseTenant();

        fireEvent.click(await screen.findByRole('button', { name: '#000000' }));
        await waitFor(() => expect(screen.getByTestId('copy-toast')).toHaveTextContent('Скопировано: #000000'));
        fireEvent.click(screen.getByRole('button', { name: 'Accent' }));
        fireEvent.click(screen.getByRole('tab', { name: 'Типографика' }));
        fireEvent.click(screen.getByRole('button', { name: 'SB Sans Text' }));
        fireEvent.click(screen.getByRole('tab', { name: 'Размеры' }));
        fireEvent.click(screen.getByRole('button', { name: '8 px' }));

        await waitFor(() => expect(copied).toEqual(['#000000', 'Accent', 'SB Sans Text', '8px']));
    });

    it('копирует через `navigator.clipboard`, если `execCommand` не сработал', async () => {
        stubCopy(false);
        const writeText = vi.fn(async () => undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });
        mount();
        await chooseTenant();

        fireEvent.click(await screen.findByRole('button', { name: '#000000' }));

        await waitFor(() => expect(screen.getByTestId('copy-toast')).toHaveTextContent('Скопировано: #000000'));
        expect(writeText).toHaveBeenCalledWith('#000000');
    });

    it('сообщает, если скопировать не удалось', async () => {
        stubCopy(false);
        mount();
        await chooseTenant();

        fireEvent.click(await screen.findByRole('button', { name: '#000000' }));

        await waitFor(() => expect(screen.getByTestId('copy-toast')).toHaveTextContent('Не удалось скопировать'));
        expect(screen.getByText('Accent')).toBeInTheDocument();
    });
});

describe('экспорт без доступа', () => {
    it('при отказе в доступе возвращает к выбору темы', async () => {
        const plan = vi.fn().mockRejectedValue(new ApiError('forbidden', 'Нет доступа'));
        mount({ api: createApi({ exportPlan: plan }) });
        await chooseTenant();
        await screen.findByText('Accent');

        fireEvent.click(screen.getByRole('button', { name: 'Экспортировать в Figma' }));

        expect(await screen.findByText('Нет доступа к этой теме.')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Тема' })).toBeInTheDocument();
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
