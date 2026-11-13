import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const config = (name: string, platform: string) => ({
        getName: () => name,
        getPlatform: () => platform,
        getMeta: () => ({}),
        getConfigurationId: () => undefined,
        getConfigurations: () => [],
        getComponentId: () => undefined,
    });
    return {
        config,
        loadComponentCatalog: vi.fn(),
        loadComponentTemplates: vi.fn(),
        hideComponent: vi.fn(),
        restoreComponent: vi.fn(),
    };
});

vi.mock('../../layouts', () => ({
    Workspace: ({ menu, content }: { menu: ReactNode; content: ReactNode }) => (
        <>
            {menu}
            {content}
        </>
    ),
}));
vi.mock('./features/ComponentEditor', () => ({
    ComponentEditor: ({
        platforms,
        onPlatformSelect,
    }: {
        platforms: { platform: 'web' | 'compose'; available: boolean }[];
        onPlatformSelect: (platform: 'web' | 'compose') => void;
    }) => (
        <div>
            {platforms.map(({ platform, available }) => (
                <button key={platform} type="button" disabled={!available} onClick={() => onPlatformSelect(platform)}>
                    {`платформа ${platform}`}
                </button>
            ))}
        </div>
    ),
}));
vi.mock('../../api/componentRepository', () => ({
    componentRepository: {
        saveComponentMutation: vi.fn(),
        loadComponentCatalog: mocks.loadComponentCatalog,
        loadComponentTemplates: mocks.loadComponentTemplates,
        hideComponent: mocks.hideComponent,
        restoreComponent: mocks.restoreComponent,
    },
}));
vi.mock('../../api/webPreviewPluginRepository', () => ({ fetchWebPreviewPluginDescriptor: vi.fn() }));
vi.mock('../../composePreview', async (original) => ({
    ...(await original<typeof import('../../composePreview')>()),
    useWebPreviewPluginLocation: () => ({ status: 'missing' }),
}));

import { notifyEditorDataInvalidated } from '../../api/draftInvalidationStream';
import { Components } from './Components';

const context = { projectId: 'project', designSystemId: 'ds', tenantId: 'tenant' };
const web = [mocks.config('Avatar', 'web'), mocks.config('Badge', 'web')];
const compose = [mocks.config('Avatar', 'compose')];
const catalog = [
    {
        componentId: 'web-avatar',
        name: 'Avatar',
        platform: 'web',
        linkId: 'link-web-avatar',
        usedBy: [],
        dependsOn: [],
    },
    { componentId: 'web-badge', name: 'Badge', platform: 'web', linkId: 'link-web-badge', usedBy: [], dependsOn: [] },
    {
        componentId: 'compose-avatar',
        name: 'Avatar',
        platform: 'compose',
        linkId: 'link-compose-avatar',
        usedBy: [],
        dependsOn: [],
    },
    { componentId: 'web-chip', name: 'Chip', platform: 'web', linkId: null, usedBy: [], dependsOn: [] },
    { componentId: 'compose-chip', name: 'Chip', platform: 'compose', linkId: null, usedBy: [], dependsOn: [] },
];

const Location = () => <div data-testid="location">{useLocation().pathname}</div>;

const renderPage = ({
    readOnly = false,
    components = web,
    reload = vi.fn(),
    loadComponent = vi.fn(async () => undefined),
} = {}) => {
    const outlet = {
        designSystem: { getParameters: () => ({ ...context, readOnly }) },
        theme: {},
        components,
        composeComponents: compose,
        updated: {},
        rerender: vi.fn(),
        reload,
        loadComponent,
    };
    render(
        <MemoryRouter initialEntries={['/components/Avatar']}>
            <Routes>
                <Route element={<Outlet context={outlet} />}>
                    <Route path="components" element={<Components />} />
                    <Route path="components/:componentName" element={<Components />} />
                </Route>
            </Routes>
            <Location />
        </MemoryRouter>,
    );
    return reload;
};

const panel = () => screen.getByRole('complementary', { name: 'Компоненты дизайн-системы' });
const confirmHide = () =>
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Скрыть' }));

describe('панель компонентов', () => {
    beforeEach(() => {
        mocks.loadComponentCatalog.mockReset().mockResolvedValue(catalog);
        mocks.loadComponentTemplates.mockReset().mockResolvedValue([]);
        mocks.hideComponent.mockReset().mockResolvedValue(undefined);
        mocks.restoreComponent.mockReset().mockResolvedValue(undefined);
    });
    afterEach(cleanup);

    it('показывает группу со счётчиком и объединяет платформы на «Все»', () => {
        renderPage();

        expect(within(panel()).getByText('Отображение данных · 2')).toBeTruthy();
        expect(within(panel()).getAllByText('Avatar')).toHaveLength(1);
    });

    it('ищет компоненты и сбрасывает запрос при закрытии поиска', () => {
        renderPage();

        fireEvent.click(within(panel()).getByRole('button', { name: 'Поиск' }));
        fireEvent.change(within(panel()).getByLabelText('Поиск компонентов'), { target: { value: 'bad' } });
        expect(within(panel()).queryByText('Avatar')).toBeNull();
        fireEvent.change(within(panel()).getByLabelText('Поиск компонентов'), { target: { value: 'zzz' } });
        expect(within(panel()).getByText('По запросу «zzz» компонентов не найдено.')).toBeTruthy();

        fireEvent.click(within(panel()).getByRole('button', { name: 'Закрыть поиск' }));
        expect(within(panel()).getByText('Avatar')).toBeTruthy();
    });

    it('сообщает о платформе без компонентов и переключает маршрут на вкладке платформы', () => {
        renderPage();

        fireEvent.click(within(panel()).getByRole('button', { name: 'iOS' }));
        expect(within(panel()).getByText(/Для выбранной платформы компонентов нет/)).toBeTruthy();

        fireEvent.click(within(panel()).getByRole('button', { name: 'Compose' }));
        expect(screen.getByTestId('location').textContent).toContain('compose');
    });

    it('не скрывает компонент, если пользователь отменил подтверждение', async () => {
        renderPage();
        const remove = () => within(panel()).getByRole('button', { name: 'Скрыть Badge из дизайн-системы' });
        await waitFor(() => expect(remove()).toHaveProperty('disabled', false));

        fireEvent.click(remove());
        fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Отмена' }));

        expect(screen.queryByRole('alertdialog')).toBeNull();
        expect(mocks.hideComponent).not.toHaveBeenCalled();
    });

    it('не даёт скрыть компонент, который используют другие компоненты', async () => {
        mocks.loadComponentCatalog.mockResolvedValue(
            catalog.map((entry) => (entry.componentId === 'web-badge' ? { ...entry, usedBy: ['Avatar'] } : entry)),
        );
        renderPage();
        const remove = () => within(panel()).getByRole('button', { name: 'Скрыть Badge из дизайн-системы' });
        await waitFor(() => expect(remove()).toHaveProperty('disabled', false));

        fireEvent.click(remove());
        const dialog = screen.getByRole('alertdialog');

        expect(within(dialog).getByText(/Его используют компонент Avatar/)).toBeTruthy();
        expect(within(dialog).queryByRole('button', { name: 'Скрыть' })).toBeNull();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Понятно' }));
        expect(mocks.hideComponent).not.toHaveBeenCalled();
    });

    it('скрывает только выбранную платформу', async () => {
        const reload = renderPage();
        await waitFor(() => expect(mocks.loadComponentCatalog).toHaveBeenCalled());

        fireEvent.click(within(panel()).getByRole('button', { name: 'Compose' }));
        await waitFor(() =>
            expect(within(panel()).getByRole('button', { name: 'Скрыть Avatar из дизайн-системы' })).toHaveProperty(
                'disabled',
                false,
            ),
        );
        fireEvent.click(within(panel()).getByRole('button', { name: 'Скрыть Avatar из дизайн-системы' }));
        expect(within(screen.getByRole('alertdialog')).getByText(/на платформе Compose/)).toBeTruthy();
        confirmHide();

        await waitFor(() => expect(reload).toHaveBeenCalled());
        expect(mocks.hideComponent.mock.calls.map(([, link]) => link)).toEqual(['link-compose-avatar']);
    });

    it('не даёт повторно скрыть компонент, пока состав не перечитан', async () => {
        let finish = () => {};
        mocks.hideComponent.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
        renderPage();
        const remove = () => within(panel()).getByRole('button', { name: 'Скрыть Badge из дизайн-системы' });
        await waitFor(() => expect(remove()).toHaveProperty('disabled', false));

        fireEvent.click(remove());
        confirmHide();
        fireEvent.click(remove());

        expect(remove()).toHaveProperty('disabled', true);
        expect(within(panel()).getByRole('button', { name: 'Скрыть Avatar из дизайн-системы' })).toHaveProperty(
            'disabled',
            false,
        );
        finish();
        await waitFor(() => expect(mocks.hideComponent).toHaveBeenCalledTimes(1));
        expect(remove()).toHaveProperty('disabled', true);
    });

    it('на «Все» скрывает компонент на всех платформах', async () => {
        const reload = renderPage();
        const remove = () => within(panel()).getByRole('button', { name: 'Скрыть Avatar из дизайн-системы' });
        await waitFor(() => expect(remove()).toHaveProperty('disabled', false));

        fireEvent.click(remove());
        expect(within(screen.getByRole('alertdialog')).getByText(/на платформах Web, Compose/)).toBeTruthy();
        confirmHide();

        await waitFor(() => expect(reload).toHaveBeenCalled());
        expect(mocks.hideComponent.mock.calls.map(([, link]) => link)).toEqual([
            'link-web-avatar',
            'link-compose-avatar',
        ]);
    });

    it('сообщает об отказе и всё равно перечитывает состав', async () => {
        mocks.hideComponent.mockRejectedValue(new Error('forbidden'));
        const reload = renderPage();
        const remove = () => within(panel()).getByRole('button', { name: 'Скрыть Badge из дизайн-системы' });
        await waitFor(() => expect(remove()).toHaveProperty('disabled', false));

        fireEvent.click(remove());
        confirmHide();

        expect(await within(panel()).findByRole('alert')).toBeTruthy();
        expect(reload).toHaveBeenCalled();
    });

    it('принудительно перечитывает данные редактора, если меню расходится с составом', async () => {
        mocks.loadComponentCatalog.mockResolvedValue(
            catalog.map((entry) => (entry.componentId === 'web-chip' ? { ...entry, linkId: 'link-web-chip' } : entry)),
        );
        const reload = renderPage();

        await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    });

    it('не перезагружает данные, когда меню совпадает с составом', async () => {
        const reload = renderPage();
        await waitFor(() => expect(mocks.loadComponentCatalog).toHaveBeenCalled());
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(reload).not.toHaveBeenCalled();
    });

    it('перечитывает меню и состав при открытии и после отката в журнале', async () => {
        const loadComponent = vi.fn(async () => undefined);
        renderPage({ loadComponent });
        await waitFor(() => expect(loadComponent).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(mocks.loadComponentCatalog).toHaveBeenCalled());
        const catalogReads = mocks.loadComponentCatalog.mock.calls.length;

        act(() => notifyEditorDataInvalidated(context, new Set(['all'])));

        await waitFor(() => expect(loadComponent).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(mocks.loadComponentCatalog.mock.calls.length).toBeGreaterThan(catalogReads));
    });

    it('перечитывает индекс меню после возврата, даже если раздел не обновился', async () => {
        const loadComponent = vi.fn(async () => undefined);
        renderPage({ loadComponent });
        const add = () => within(panel()).getByRole('button', { name: 'Вернуть скрытый компонент' });
        await waitFor(() => expect(add()).toHaveProperty('disabled', false));

        fireEvent.click(add());
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('checkbox', { name: /Chip/ }));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Добавить' }));

        await waitFor(() => expect(loadComponent).toHaveBeenCalledWith());
    });

    it('возвращает скрытый компонент на одной платформе', async () => {
        const reload = renderPage();
        const add = () => within(panel()).getByRole('button', { name: 'Вернуть скрытый компонент' });
        await waitFor(() => expect(add()).toHaveProperty('disabled', false));

        fireEvent.click(add());
        const dialog = screen.getByRole('dialog');
        fireEvent.click(within(dialog).getByRole('checkbox', { name: /Chip/ }));
        fireEvent.click(within(dialog).getByRole('button', { name: 'Compose' }));
        fireEvent.click(within(dialog).getByRole('button', { name: 'Добавить' }));

        await waitFor(() => expect(reload).toHaveBeenCalled());
        expect(mocks.restoreComponent.mock.calls.map(([, id]) => id)).toEqual(['compose-chip']);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('выбирает все найденные скрытые компоненты чекбоксом группы', async () => {
        mocks.loadComponentCatalog.mockResolvedValue([
            ...catalog,
            { componentId: 'web-rating', name: 'Rating', platform: 'web', linkId: null, usedBy: [], dependsOn: [] },
        ]);
        const reload = renderPage();
        const add = () => within(panel()).getByRole('button', { name: 'Вернуть скрытый компонент' });
        await waitFor(() => expect(add()).toHaveProperty('disabled', false));

        fireEvent.click(add());
        const dialog = screen.getByRole('dialog');
        const all = within(dialog).getByRole('checkbox', { name: 'Выбрать все скрытые' });
        fireEvent.click(within(dialog).getByRole('checkbox', { name: /Chip/ }));
        expect(all).toHaveProperty('indeterminate', true);

        fireEvent.click(all);
        expect(within(dialog).getByRole('checkbox', { name: /Rating/ })).toHaveProperty('checked', true);
        expect(all).toHaveProperty('checked', true);
        fireEvent.click(within(dialog).getByRole('button', { name: 'Добавить (2)' }));

        await waitFor(() => expect(reload).toHaveBeenCalled());
        expect(mocks.restoreComponent.mock.calls.map(([, id]) => id)).toEqual([
            'web-chip',
            'compose-chip',
            'web-rating',
        ]);
    });

    it('меняет ширину панели с клавиатуры в пределах границ и запоминает её', () => {
        localStorage.removeItem('ds_components_panel');
        renderPage();
        const resizer = within(panel()).getByRole('separator', { name: 'Ширина панели компонентов' });

        fireEvent.keyDown(resizer, { key: 'ArrowRight', shiftKey: true });
        expect(resizer.getAttribute('aria-valuenow')).toBe('296');
        expect(JSON.parse(localStorage.getItem('ds_components_panel')!)).toEqual({ left: 296 });

        for (let step = 0; step < 10; step += 1) fireEvent.keyDown(resizer, { key: 'ArrowRight', shiftKey: true });
        expect(resizer.getAttribute('aria-valuenow')).toBe('320');
    });

    it('возвращает вместе с компонентом скрытые компоненты, от которых он зависит', async () => {
        mocks.loadComponentCatalog.mockResolvedValue([
            ...catalog,
            {
                componentId: 'web-group',
                name: 'ChipGroup',
                platform: 'web',
                linkId: null,
                usedBy: [],
                dependsOn: ['web-chip'],
            },
        ]);
        const reload = renderPage();
        const add = () => within(panel()).getByRole('button', { name: 'Вернуть скрытый компонент' });
        await waitFor(() => expect(add()).toHaveProperty('disabled', false));

        fireEvent.click(add());
        const dialog = screen.getByRole('dialog');
        fireEvent.click(within(dialog).getByRole('checkbox', { name: /ChipGroup/ }));
        expect(within(dialog).getByText(/Вместе с ними добавятся Chip/)).toBeTruthy();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Добавить' }));

        await waitFor(() => expect(reload).toHaveBeenCalled());
        expect(mocks.restoreComponent.mock.calls.map(([, id]) => id)).toEqual(['web-group', 'web-chip']);
    });

    it('перечитывает состав после возврата, даже если меню не изменилось', async () => {
        renderPage();
        const add = () => within(panel()).getByRole('button', { name: 'Вернуть скрытый компонент' });
        await waitFor(() => expect(add()).toHaveProperty('disabled', false));
        mocks.loadComponentCatalog.mockClear();
        mocks.loadComponentCatalog.mockResolvedValue(
            catalog.map((entry) => (entry.name === 'Chip' ? { ...entry, linkId: `link-${entry.componentId}` } : entry)),
        );

        fireEvent.click(add());
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('checkbox', { name: /Chip/ }));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Добавить' }));

        await waitFor(() => expect(mocks.loadComponentCatalog.mock.calls.length).toBeGreaterThanOrEqual(2));
        fireEvent.click(add());
        await waitFor(() =>
            expect(within(screen.getByRole('dialog')).queryByRole('checkbox', { name: /^Chip/ })).toBeNull(),
        );
    });

    it('добавляет новый компонент из шаблона одним запросом', async () => {
        mocks.loadComponentTemplates.mockResolvedValue([
            { componentId: 'web-chip', name: 'Chip', platform: 'web', dependsOn: [] },
            { componentId: 'web-group', name: 'ButtonGroup', platform: 'web', dependsOn: ['web-button'] },
            { componentId: 'web-button', name: 'Button', platform: 'web', dependsOn: [] },
        ]);
        const reload = renderPage();
        const add = () => within(panel()).getByRole('button', { name: 'Вернуть скрытый компонент' });
        await waitFor(() => expect(add()).toHaveProperty('disabled', false));

        fireEvent.click(add());
        const dialog = await screen.findByRole('dialog');
        const group = (name: string) => within(dialog).getByRole('region', { name });
        expect(within(group('Новые')).getByRole('checkbox', { name: /ButtonGroup/ })).toBeTruthy();
        expect(within(group('Скрытые')).getByRole('checkbox', { name: /^Chip/ })).toBeTruthy();
        expect(within(group('Скрытые')).queryByRole('checkbox', { name: /ButtonGroup/ })).toBeNull();
        fireEvent.click(within(dialog).getByRole('checkbox', { name: /ButtonGroup/ }));
        expect(within(dialog).getByText(/Вместе с ними добавятся Button/)).toBeTruthy();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Добавить' }));

        await waitFor(() => expect(reload).toHaveBeenCalled());
        expect(mocks.restoreComponent.mock.calls.map(([, id, fromTemplate]) => [id, fromTemplate])).toEqual([
            ['web-group', true],
        ]);
    });

    it('не даёт менять состав в режиме только для чтения', async () => {
        renderPage({ readOnly: true });
        await waitFor(() => expect(mocks.loadComponentCatalog).toHaveBeenCalled());

        expect(within(panel()).getByRole('button', { name: 'Вернуть скрытый компонент' })).toHaveProperty(
            'disabled',
            true,
        );
        expect(within(panel()).getByRole('button', { name: 'Скрыть Badge из дизайн-системы' })).toHaveProperty(
            'disabled',
            true,
        );
    });

    it('остаётся на странице, когда скрыты все компоненты', () => {
        render(
            <MemoryRouter initialEntries={['/components']}>
                <Routes>
                    <Route
                        element={
                            <Outlet
                                context={{
                                    designSystem: { getParameters: () => context },
                                    theme: {},
                                    components: [],
                                    composeComponents: [],
                                    updated: {},
                                    rerender: vi.fn(),
                                    reload: vi.fn(),
                                }}
                            />
                        }
                    >
                        <Route path="components" element={<Components />} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );

        expect(within(panel()).getByText(/В дизайн-системе нет компонентов/)).toBeTruthy();
    });

    it('меню платформы превью открывает тот же компонент на другой платформе', () => {
        renderPage();

        fireEvent.click(screen.getByRole('button', { name: 'платформа compose' }));

        expect(screen.getByTestId('location').textContent).toBe('/components/compose-Avatar');
    });

    it('пункт платформы без компонента недоступен', () => {
        renderPage();

        fireEvent.click(within(panel()).getByText('Badge'));

        expect(screen.getByTestId('location').textContent).toBe('/components/Badge');
        expect((screen.getByRole('button', { name: 'платформа compose' }) as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByRole('button', { name: 'платформа web' }) as HTMLButtonElement).disabled).toBe(false);
    });
});
