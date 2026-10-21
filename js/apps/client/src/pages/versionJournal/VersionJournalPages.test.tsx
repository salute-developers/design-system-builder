import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const operations = vi.hoisted(() => ({
    listChanges: vi.fn(),
    listJournalTokens: vi.fn(),
    listProjectActorLabels: vi.fn(),
    listVersions: vi.fn(),
    getDesignSystem: vi.fn(),
    revertChange: vi.fn(),
    publish: vi.fn(),
    waitForDraftAutosaveIdle: vi.fn(),
    reloadEditor: vi.fn(),
    refreshChanges: vi.fn(),
}));

vi.mock('../../api/versionJournalRepository', () => ({ versionJournalRepository: operations }));
vi.mock('../../api/tokenRepository', () => ({ tokenRepository: { listDefinitions: operations.listJournalTokens } }));

vi.mock('../../api/draftAutosaveActivity', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../api/draftAutosaveActivity')>();
    return { ...actual, waitForDraftAutosaveIdle: operations.waitForDraftAutosaveIdle };
});

import { DesignSystemChangesPage, DesignSystemVersionsPage } from './VersionJournalPages';

const context = { projectId: 'project-1', designSystemId: 'ds-1', tenantId: 'tenant-1' };
const designSystem = {
    getComponentsData: () => [],
    getParameters: () => ({ readOnly: false }),
};
const change = {
    changeId: 'change-1',
    versionId: 'draft-1',
    entityType: 'token',
    entityId: 'token-1',
    operation: 'updated' as const,
    changedPaths: ['/display_name'],
    previousValue: { display_name: 'Старое название' },
    currentValue: { display_name: 'Новое название' },
    actorId: 'user-1',
    changedAt: '2026-10-16T10:00:00Z',
    editRevision: 7,
    parameterRevertSupported: true,
};
const token = {
    id: 'token-1',
    designSystemId: 'ds-1',
    name: 'text.body.fontSize',
    type: 'typography' as const,
    displayName: 'Размер текста',
    description: null,
    enabled: true,
};

const renderPage = (page: 'changes' | 'versions', initial = page) =>
    render(
        <MemoryRouter initialEntries={[`/projects/project-1/design-systems/ds-1/themes/tenant-1/${initial}`]}>
            <Routes>
                <Route
                    path="/projects/:projectId/design-systems/:designSystemId/themes/:tenantId"
                    element={
                        <Outlet
                            context={{
                                designSystem,
                                editorContext: context,
                                updated: {},
                                reload: operations.reloadEditor,
                                refreshChanges: operations.refreshChanges,
                            }}
                        />
                    }
                >
                    <Route path="changes" element={<DesignSystemChangesPage />} />
                    <Route path="versions" element={<DesignSystemVersionsPage />} />
                    <Route path="typography" element={<div>Редактор типографики</div>} />
                </Route>
            </Routes>
        </MemoryRouter>,
    );

beforeEach(() => {
    localStorage.clear();
    Object.values(operations).forEach((operation) => operation.mockReset());
    operations.listChanges.mockResolvedValue([change]);
    operations.listJournalTokens.mockResolvedValue([token]);
    operations.listProjectActorLabels.mockResolvedValue({ 'user-1': 'Анна' });
    operations.listVersions.mockResolvedValue([]);
    operations.getDesignSystem.mockResolvedValue({ draftId: 'draft-1', draftRevision: 7 });
    operations.revertChange.mockResolvedValue({});
    operations.refreshChanges.mockResolvedValue(undefined);
    operations.publish.mockResolvedValue({
        id: 'version-1',
        designSystemId: 'ds-1',
        sequenceNumber: 1,
        revision: 7,
        version: '0.1.0',
        changelog: 'Первая версия',
        publishedAt: '2026-10-16T11:00:00Z',
    });
    operations.waitForDraftAutosaveIdle.mockResolvedValue(undefined);
    operations.reloadEditor.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('DesignSystemChangesPage', () => {
    it('при отказе журнала после неизвестного результата блокирует отмену и повторяет только чтения', async () => {
        operations.revertChange.mockRejectedValueOnce(new Error('response lost after commit'));
        operations.listChanges.mockResolvedValueOnce([change]).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
        renderPage('changes');
        fireEvent.click(await screen.findByRole('button', { name: /^Отменить изменение:/ }));
        const retry = await screen.findByRole('button', { name: 'Повторить загрузку данных' });
        expect(screen.getByRole('button', { name: /^Отменить изменение:/ })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Перейти к источнику' })).toBeDisabled();
        fireEvent.click(retry);
        await screen.findByText(/Неопубликованных изменений нет/);
        expect(operations.revertChange).toHaveBeenCalledTimes(1);
        expect(operations.listChanges).toHaveBeenCalledTimes(3);
        expect(operations.refreshChanges).toHaveBeenCalledTimes(2);
    });

    it('ждёт обновления предметных данных после отмены, не разрешая переход к старому источнику', async () => {
        let finish!: () => void;
        operations.refreshChanges.mockReturnValue(
            new Promise<void>((resolve) => {
                finish = resolve;
            }),
        );
        renderPage('changes');
        const undo = await screen.findByRole('button', { name: /^Отменить изменение:/ });
        fireEvent.click(undo);
        await waitFor(() => expect(operations.refreshChanges).toHaveBeenCalledWith([change]));
        expect(screen.getByRole('button', { name: 'Перейти к источнику' })).toBeDisabled();
        expect(operations.listChanges).toHaveBeenCalledTimes(2);
        finish();
        await waitFor(() => expect(operations.listChanges).toHaveBeenCalledTimes(2));
        expect(screen.getByRole('button', { name: 'Перейти к источнику' })).toBeEnabled();
    });
    it('после сбоя обновления повторяет только чтение, а не уже выполненную отмену', async () => {
        operations.refreshChanges.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
        renderPage('changes');
        fireEvent.click(await screen.findByRole('button', { name: /^Отменить изменение:/ }));
        const retry = await screen.findByRole('button', { name: 'Повторить загрузку данных' });
        expect(screen.getByRole('button', { name: 'Перейти к источнику' })).toBeDisabled();
        fireEvent.click(retry);
        await waitFor(() =>
            expect(screen.queryByRole('button', { name: 'Повторить загрузку данных' })).not.toBeInTheDocument(),
        );
        expect(operations.revertChange).toHaveBeenCalledTimes(1);
        expect(operations.refreshChanges).toHaveBeenCalledTimes(2);
    });
    it('сохраняет список на экране до получения обновлённого журнала после отмены', async () => {
        let completeReload: ((changes: (typeof change)[]) => void) | undefined;
        const response = new Promise<(typeof change)[]>((resolve) => {
            completeReload = resolve;
        });
        operations.listChanges.mockResolvedValueOnce([change]).mockReturnValueOnce(response);
        renderPage('changes');
        fireEvent.click(await screen.findByRole('button', { name: 'Отменить изменение: Типографика: Размер текста' }));
        await waitFor(() => expect(operations.listChanges).toHaveBeenCalledTimes(2));

        expect(screen.getAllByText('Типографика: Размер текста').length).toBeGreaterThan(0);
        expect(screen.queryByText('Загрузка журнала…')).not.toBeInTheDocument();
        completeReload?.([]);
        expect(await screen.findByText(/Неопубликованных изменений нет/)).toBeInTheDocument();
    });

    it('отменяет изменение кнопкой непосредственно в строке списка', async () => {
        renderPage('changes');
        const undo = await screen.findByRole('button', { name: 'Отменить изменение: Типографика: Размер текста' });
        fireEvent.click(undo);
        await waitFor(() => expect(operations.revertChange).toHaveBeenCalledWith(context, change));
        expect(operations.revertChange).toHaveBeenCalledTimes(1);
    });

    it('показывает счётчики только непустых фильтров и склоняет количество изменений', async () => {
        renderPage('changes');
        await screen.findByText('1 изменение');
        const filters = screen.getByRole('complementary', { name: 'Фильтры журнала' });
        expect(within(filters).queryByText('Область')).not.toBeInTheDocument();
        expect(within(filters).getByText('Черновик изменений').parentElement).not.toHaveTextContent('1');
        expect(within(filters).getByRole('button', { name: 'Все изменения 1' })).toBeInTheDocument();
        expect(within(filters).getByRole('button', { name: 'Типографика 1' })).toBeInTheDocument();
        expect(within(filters).getByRole('button', { name: 'Палитра' })).not.toHaveTextContent('0');
        expect(within(filters).getByRole('button', { name: 'Темы' })).not.toHaveTextContent('0');
    });

    it('отменяет платформу отдельно, не отправляя отмену остальных платформ', async () => {
        const web = {
            ...change,
            changeId: 'web',
            entityId: 'web-value',
            entityType: 'token-value',
            changedPaths: ['/value'],
            previousValue: { token_id: token.id, platform: 'web', value: 14 },
            currentValue: { token_id: token.id, platform: 'web', value: 16 },
        };
        const ios = {
            ...web,
            changeId: 'ios',
            entityId: 'ios-value',
            previousValue: { ...web.previousValue, platform: 'ios' },
            currentValue: { ...web.currentValue, platform: 'ios' },
        };
        operations.listChanges.mockResolvedValue([web, ios]);
        renderPage('changes');
        fireEvent.click(
            await screen.findByRole('button', {
                name: 'Отменить изменение: Типографика: Размер текста · Значение · iOS',
            }),
        );
        await waitFor(() => expect(operations.revertChange).toHaveBeenCalledTimes(1));
        expect(operations.revertChange).toHaveBeenCalledWith(context, ios, ['/value']);
    });

    it('отменяет выбранный параметр типографики отдельным запросом', async () => {
        const typography = {
            ...change,
            entityType: 'token-value',
            changedPaths: ['/value'],
            previousValue: { token_id: token.id, platform: 'web', value: { fontSize: '1rem', lineHeight: '1.5rem' } },
            currentValue: {
                token_id: token.id,
                platform: 'web',
                value: { fontSize: '1.125rem', lineHeight: '1.75rem' },
            },
        };
        operations.listChanges.mockResolvedValue([typography]);
        renderPage('changes');
        const undo = await screen.findByRole('button', {
            name: 'Отменить изменение: Типографика: Размер текста · Font size · Web',
        });
        expect(
            screen.getByRole('button', { name: 'Отменить изменение: Типографика: Размер текста · Line height · Web' }),
        ).toBeInTheDocument();
        fireEvent.click(undo);
        await waitFor(() =>
            expect(operations.revertChange).toHaveBeenCalledWith(context, typography, ['/value/fontSize']),
        );
        expect(operations.revertChange).toHaveBeenCalledTimes(1);
    });

    it('показывает автора и значения, фильтрует локально и отменяет выбранное изменение', async () => {
        renderPage('changes');

        expect((await screen.findAllByText('Типографика: Размер текста')).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Анна/).length).toBeGreaterThan(0);
        expect(
            within(screen.getByRole('complementary', { name: 'Подробности изменения' })).getByText('Старое название'),
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /^Типографика\s*1$/ }));
        expect(operations.listChanges).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole('button', { name: 'Отменить изменение' }));
        await waitFor(() => expect(operations.revertChange).toHaveBeenCalledWith(context, change));
    });

    it('обновляет журнал без автоматического повтора при устаревшей отмене', async () => {
        operations.revertChange.mockRejectedValueOnce({
            isAxiosError: true,
            response: { data: { code: 'DRAFT_CHANGE_STALE' } },
        });
        renderPage('changes');

        await screen.findAllByText('Типографика: Размер текста');
        fireEvent.click(screen.getByRole('button', { name: 'Отменить изменение' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Черновик уже изменился');
        expect(operations.revertChange).toHaveBeenCalledTimes(1);
        expect(operations.listChanges).toHaveBeenCalledTimes(2);
    });

    it('различает пустой журнал и ошибку загрузки', async () => {
        operations.listChanges.mockResolvedValueOnce([]);
        const first = renderPage('changes');
        expect(await screen.findByText(/Неопубликованных изменений нет/)).toBeInTheDocument();
        first.unmount();

        operations.listChanges.mockRejectedValueOnce(new Error('network'));
        renderPage('changes');
        expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить журнал');
    });
});

describe('DesignSystemVersionsPage', () => {
    it('использует готовый журнал оболочки для той же границы, не загружая его повторно', async () => {
        render(
            <MemoryRouter initialEntries={['/versions']}>
                <Routes>
                    <Route
                        element={
                            <Outlet
                                context={{
                                    designSystem,
                                    editorContext: context,
                                    updated: {},
                                    reload: operations.reloadEditor,
                                    editorJournal: {
                                        changes: [],
                                        tokens: [],
                                        actorLabels: {},
                                        actions: [],
                                        loading: false,
                                        reload: vi.fn(),
                                    },
                                }}
                            />
                        }
                    >
                        <Route path="versions" element={<DesignSystemVersionsPage />} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );
        await screen.findByText('Публиковать нечего. Откройте редактор и внесите изменения.');
        expect(operations.listChanges).not.toHaveBeenCalled();
        expect(operations.listJournalTokens).not.toHaveBeenCalled();
    });
    it('разрешает публикацию без примечаний', async () => {
        renderPage('versions');
        await screen.findAllByText('Типографика: Размер текста');
        const publish = screen.getByRole('button', { name: 'Опубликовать версию' });
        expect(publish).toBeEnabled();
        fireEvent.click(publish);
        await waitFor(() =>
            expect(operations.publish).toHaveBeenCalledWith(context, 'draft-1', 7, '0.1.0', '', expect.any(String)),
        );
    });

    it('не отправляет форму публикации при нажатии на строку состава без доступного источника', async () => {
        operations.listChanges.mockResolvedValue([{ ...change, entityType: 'unknown' }]);
        renderPage('versions');
        const row = await screen.findByRole('button', { name: /Изменение настройки дизайн-системы/ });
        fireEvent.change(screen.getByLabelText('Описание'), { target: { value: 'Новая версия' } });
        fireEvent.click(row);
        expect(row).toHaveAttribute('type', 'button');
        expect(operations.publish).not.toHaveBeenCalled();
        expect(operations.waitForDraftAutosaveIdle).not.toHaveBeenCalled();
    });

    it('публикует серверную версию после ожидания автосохранения', async () => {
        renderPage('versions');

        await screen.findAllByText('Типографика: Размер текста');
        fireEvent.change(screen.getByLabelText('Описание'), { target: { value: 'Первая версия' } });
        fireEvent.click(screen.getByRole('button', { name: 'Опубликовать версию' }));

        await waitFor(() => expect(operations.waitForDraftAutosaveIdle).toHaveBeenCalledWith(context, 10_000));
        expect(operations.publish).toHaveBeenCalledWith(
            context,
            'draft-1',
            7,
            '0.1.0',
            'Первая версия',
            expect.any(String),
        );
        expect(await screen.findByText('Версия 0.1.0 создана')).toBeInTheDocument();
        expect(operations.reloadEditor).toHaveBeenCalledTimes(1);
        expect(screen.queryByText(/npm/i)).not.toBeInTheDocument();
    });

    it('показывает опубликованную версию только для чтения', async () => {
        operations.listVersions.mockResolvedValueOnce([
            {
                id: 'version-1',
                designSystemId: 'ds-1',
                sequenceNumber: 1,
                revision: 7,
                version: '1.0.0',
                changelog: 'Стабильная версия',
                publishedAt: '2026-10-16T11:00:00Z',
            },
        ]);
        renderPage('versions', 'versions?historyVersionId=version-1');

        expect(await screen.findByText('Версия 1.0.0')).toBeInTheDocument();
        expect(screen.getByText('Стабильная версия')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Опубликовать версию' })).not.toBeInTheDocument();
        expect(screen.queryByText(/Проверки|Контрольная сумма|Восстановить/)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Черновик публикации' })).toBeInTheDocument();
        expect(operations.listChanges).toHaveBeenCalledWith(
            { ...context, versionId: 'version-1' },
            expect.any(AbortSignal),
        );
    });

    it('сохраняет параметры формы и требует явного повтора после DRAFT_STALE', async () => {
        operations.publish.mockRejectedValueOnce({
            isAxiosError: true,
            response: { data: { code: 'DRAFT_STALE' } },
        });
        renderPage('versions');
        await screen.findAllByText('Типографика: Размер текста');
        fireEvent.change(screen.getByLabelText('Описание'), { target: { value: 'Новая версия' } });
        fireEvent.click(screen.getByRole('button', { name: 'Опубликовать версию' }));

        expect(await screen.findByText(/Черновик изменился/)).toBeInTheDocument();
        expect(screen.getByLabelText('Описание')).toHaveValue('Новая версия');
        expect(operations.publish).toHaveBeenCalledTimes(1);
        expect(operations.reloadEditor).toHaveBeenCalledTimes(1);
    });

    it('не утверждает, что черновик сохранён, если ожидание автосохранения завершилось ошибкой', async () => {
        operations.waitForDraftAutosaveIdle.mockRejectedValueOnce(new Error('timeout'));
        renderPage('versions');
        await screen.findAllByText('Типографика: Размер текста');
        fireEvent.change(screen.getByLabelText('Описание'), { target: { value: 'Новая версия' } });
        fireEvent.click(screen.getByRole('button', { name: 'Опубликовать версию' }));

        expect(await screen.findByText(/Изменения ещё не сохранены/)).toBeInTheDocument();
        expect(operations.publish).not.toHaveBeenCalled();
    });

    it('не публикует версию при прямом открытии с сохранённым ожидающим изменением компонента', async () => {
        localStorage.setItem('ds_pending_component:project-1:ds-1:tenant-1:Button:request', '{"generation":"g-1"}');
        renderPage('versions');
        await screen.findAllByText('Типографика: Размер текста');
        fireEvent.change(screen.getByLabelText('Описание'), { target: { value: 'Новая версия' } });
        fireEvent.click(screen.getByRole('button', { name: 'Опубликовать версию' }));

        expect(await screen.findByText(/Есть несохранённое изменение компонента/)).toBeInTheDocument();
        expect(operations.publish).not.toHaveBeenCalled();
        localStorage.clear();
    });

    it('предлагает следующий номер после успешной публикации пользовательской версии', async () => {
        operations.publish.mockResolvedValueOnce({
            id: 'version-1',
            designSystemId: 'ds-1',
            sequenceNumber: 1,
            revision: 7,
            version: '1.4.7',
            changelog: 'Версия',
            publishedAt: '2026-10-16T11:00:00Z',
        });
        renderPage('versions');
        await screen.findAllByText('Типографика: Размер текста');
        fireEvent.change(screen.getByLabelText('Номер версии'), { target: { value: '1.4.7' } });
        fireEvent.change(screen.getByLabelText('Описание'), { target: { value: 'Версия' } });
        fireEvent.click(screen.getByRole('button', { name: 'Опубликовать версию' }));

        await screen.findByText('Версия 1.4.7 создана');
        expect(screen.getByLabelText('Номер версии')).toHaveValue('1.4.8');
    });

    it('не принимает запоздавший ответ черновика после выбора опубликованной версии', async () => {
        let resolveDraft: ((value: (typeof change)[]) => void) | undefined;
        const draftResponse = new Promise<(typeof change)[]>((resolve) => {
            resolveDraft = resolve;
        });
        const historicalChange = {
            ...change,
            changeId: 'historical-change',
            entityType: 'tenant',
            entityId: 'tenant-1',
            changedPaths: ['/name'],
            previousValue: { name: 'Старая историческая тема' },
            currentValue: { name: 'Историческая тема' },
        };
        operations.listChanges.mockImplementation((requestedContext: typeof context & { versionId?: string }) =>
            requestedContext.versionId ? Promise.resolve([historicalChange]) : draftResponse,
        );
        operations.listVersions.mockResolvedValue([
            {
                id: 'version-1',
                designSystemId: 'ds-1',
                sequenceNumber: 1,
                revision: 7,
                version: '1.0.0',
                changelog: 'Стабильная версия',
                publishedAt: '2026-10-16T11:00:00Z',
            },
        ]);
        renderPage('versions');

        fireEvent.click(await screen.findByRole('button', { name: /1\.0\.0/ }));
        expect(await screen.findByText('Изменение темы «Историческая тема»')).toBeInTheDocument();
        resolveDraft?.([{ ...change, currentValue: { display_name: 'Запоздавший черновик' } }]);
        await Promise.resolve();

        expect(screen.queryByText('Типографика: Размер текста')).not.toBeInTheDocument();
        expect(screen.getByText('Изменение темы «Историческая тема»')).toBeInTheDocument();
    });

    it('не выдаёт неизвестную версию за активный черновик', async () => {
        renderPage('versions', 'versions?historyVersionId=missing');

        expect(await screen.findByRole('heading', { name: 'Версия не найдена' })).toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveTextContent('Выбранная версия не существует');
        expect(screen.queryByRole('button', { name: 'Опубликовать версию' })).not.toBeInTheDocument();
    });

    it('не показывает действия записи до подтверждения прав редактора', async () => {
        render(
            <MemoryRouter initialEntries={['/changes']}>
                <Routes>
                    <Route
                        element={
                            <Outlet
                                context={{
                                    designSystem: undefined,
                                    editorContext: context,
                                    updated: {},
                                    reload: operations.reloadEditor,
                                }}
                            />
                        }
                    >
                        <Route path="changes" element={<DesignSystemChangesPage />} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );

        await screen.findAllByText('Типографика: Размер текста');
        expect(screen.queryByRole('button', { name: 'Отменить изменение' })).not.toBeInTheDocument();
    });

    it('не позволяет старому запросу версий перезаписать список другого контекста', async () => {
        let resolveFirst:
            | ((
                  value: Array<{
                      id: string;
                      designSystemId: string;
                      sequenceNumber: number;
                      revision: number;
                      version: string;
                      changelog: string;
                      publishedAt: string;
                  }>,
              ) => void)
            | undefined;
        const firstResponse = new Promise<
            Array<{
                id: string;
                designSystemId: string;
                sequenceNumber: number;
                revision: number;
                version: string;
                changelog: string;
                publishedAt: string;
            }>
        >((resolve) => {
            resolveFirst = resolve;
        });
        operations.listVersions.mockImplementation((requestedContext: typeof context) =>
            requestedContext.designSystemId === 'ds-1'
                ? firstResponse
                : Promise.resolve([
                      {
                          id: 'version-2',
                          designSystemId: 'ds-2',
                          sequenceNumber: 1,
                          revision: 1,
                          version: '2.0.0',
                          changelog: 'Вторая ДС',
                          publishedAt: '2026-10-16T12:00:00Z',
                      },
                  ]),
        );
        const DynamicParent = () => {
            const [activeContext, setActiveContext] = useState(context);
            return (
                <>
                    <button onClick={() => setActiveContext({ ...context, designSystemId: 'ds-2' })}>Сменить ДС</button>
                    <Outlet
                        context={{
                            designSystem,
                            editorContext: activeContext,
                            updated: {},
                            reload: operations.reloadEditor,
                        }}
                    />
                </>
            );
        };
        render(
            <MemoryRouter initialEntries={['/versions']}>
                <Routes>
                    <Route element={<DynamicParent />}>
                        <Route path="versions" element={<DesignSystemVersionsPage />} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Сменить ДС' }));
        expect(await screen.findByRole('button', { name: /2\.0\.0/ })).toBeInTheDocument();
        resolveFirst?.([
            {
                id: 'version-1',
                designSystemId: 'ds-1',
                sequenceNumber: 1,
                revision: 1,
                version: '1.0.0',
                changelog: 'Первая ДС',
                publishedAt: '2026-10-16T11:00:00Z',
            },
        ]);
        await Promise.resolve();

        expect(screen.queryByRole('button', { name: /1\.0\.0/ })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /2\.0\.0/ })).toBeInTheDocument();
    });
});
