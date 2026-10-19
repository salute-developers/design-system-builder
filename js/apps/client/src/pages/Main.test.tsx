import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const { hookState, reload, mainUtils } = vi.hoisted(() => ({
    hookState: { loading: false, components: [] as unknown[] },
    reload: vi.fn(),
    mainUtils: { designSystemSave: vi.fn() },
}));
vi.mock('./Main.utils', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./Main.utils')>()),
    designSystemSave: mainUtils.designSystemSave,
}));
vi.mock('../hooks', () => ({
    useForceRerender: () => [null, vi.fn()],
    useDesignSystem: () => ({
        designSystem: hookState.loading
            ? null
            : {
                  getName: () => 'System',
                  getVersion: () => '0.1.0',
                  getComponentsData: () => [],
                  getParameters: () => ({
                      projectName: 'Platform',
                      packagesName: 'System',
                      accentColor: 'blue',
                      darkFillSaturation: 500,
                      readOnly: false,
                  }),
              },
        theme: hookState.loading ? null : { getName: () => 'Brand' },
        components: hookState.loading ? null : hookState.components,
        composeComponents: [],
        incompleteTokenIds: [],
        loadError: null,
        reload,
    }),
}));

vi.mock('../features/versionJournal/useJournal', () => ({
    useJournal: () => ({ actions: [], loading: false, error: undefined, reload: vi.fn() }),
    useReloadAfterAutosave: vi.fn(),
}));
vi.mock('../components/EditorVersionSelect', () => ({
    EditorVersionSelect: () => <span>Выбор версии</span>,
}));

import { Main } from './Main';
import { setActiveDraftContext } from '../utils';

// Ключ черновика выбранного tenant: так его строит редактор темы при активном контексте.
const DRAFT_KEY = 'ds_draft:project-1:ds-1:theme-1';

const renderEditor = () =>
    render(
        <MemoryRouter initialEntries={['/projects/project-1/design-systems/ds-1/themes/theme-1/colors']}>
            <Routes>
                <Route path="/projects/:projectId/design-systems/:designSystemId/themes/:tenantId" element={<Main />}>
                    <Route path="colors" element={<div />} />
                </Route>
            </Routes>
        </MemoryRouter>,
    );

beforeEach(() => {
    setActiveDraftContext({ projectId: 'project-1', designSystemId: 'ds-1', tenantId: 'theme-1' });
});

afterEach(() => {
    setActiveDraftContext(null);
    hookState.loading = false;
    hookState.components = [];
    localStorage.clear();
    vi.clearAllMocks();
    cleanup();
    vi.unstubAllEnvs();
});

describe('Theme editor shell', () => {
    it('does not retain the previous section while the next route is pending', async () => {
        let ready = false;
        let finish: () => void = () => undefined;
        const completion = new Promise<void>((resolve) => { finish = resolve; });
        const Settings = () => {
            if (!ready) throw completion;
            return <div>Новые настройки</div>;
        };
        render(
            <MemoryRouter initialEntries={['/projects/project-1/design-systems/ds-1/themes/theme-1/colors']}>
                <Suspense fallback={<div>Загрузка маршрута</div>}>
                    <Routes>
                        <Route path="/projects/:projectId/design-systems/:designSystemId/themes/:tenantId" element={<Main />}>
                            <Route path="colors" element={<div data-testid="previous-section">Старое содержимое</div>} />
                            <Route path="settings" element={<Settings />} />
                        </Route>
                    </Routes>
                </Suspense>
            </MemoryRouter>,
        );
        const rail = screen.getByTestId('editor-rail');
        fireEvent.click(screen.getByRole('button', { name: 'Настройки темы' }));
        expect(screen.queryByTestId('previous-section')).not.toBeInTheDocument();
        expect(screen.getByRole('status', { name: 'Открываем раздел' })).toBeInTheDocument();
        expect(screen.getByTestId('editor-rail')).toBe(rail);
        await act(async () => { ready = true; finish(); await completion; });
        expect(screen.getByText('Новые настройки')).toBeInTheDocument();
        expect(screen.queryByRole('status', { name: 'Открываем раздел' })).not.toBeInTheDocument();
    });

    it.each([
        ['colors', 'Цветовые токены'],
        ['typography', 'Типографика'],
        ['shapes', 'Размеры и радиусы'],
        ['components/Button', 'Компоненты'],
        ['changes', 'Журнал изменений'],
        ['versions', 'Версии'],
    ])('shows the section for %s and preserves the version in the theme breadcrumb', (section, label) => {
        render(
            <MemoryRouter initialEntries={[`/projects/project-1/design-systems/ds-1/themes/theme-1/${section}?versionId=published-1`]}>
                <Routes>
                    <Route path="/projects/:projectId/design-systems/:designSystemId/themes/:tenantId" element={<Main />}>
                        <Route path="*" element={<div />} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );
        const breadcrumbs = screen.getByRole('navigation', { name: 'Навигация темы' });
        expect(breadcrumbs.querySelector('[aria-current="page"]')).toHaveTextContent(label);
        expect(screen.getByRole('link', { name: 'Brand' })).toHaveAttribute('href', '/projects/project-1/design-systems/ds-1/themes/theme-1/colors?versionId=published-1');
    });

    it('uses breadcrumbs for hierarchy, opens Theme settings, and omits the obsolete overview action', () => {
        const view = render(
            <MemoryRouter initialEntries={['/projects/project-1/design-systems/ds-1/themes/theme-1/colors']}>
                <Routes>
                    <Route
                        path="/projects/:projectId/design-systems/:designSystemId/themes/:tenantId"
                        element={<Main />}
                    >
                        <Route path="colors" element={<div>Цветовые токены</div>} />
                        <Route path="settings" element={<div>Параметры темы</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );

        const breadcrumbs = screen.getByRole('navigation', { name: 'Навигация темы' });
        expect(screen.getByTestId('editor-rail')).toHaveClass('builder-icon-sidebar');
        expect(screen.getByRole('button', { name: 'Изменения' })).not.toHaveTextContent('0');
        expect(screen.getByRole('button', { name: 'Изменения' })).not.toHaveTextContent('·');
        expect(breadcrumbs.closest('header')).toHaveClass('builder-hierarchy-bar');
        expect(breadcrumbs).toHaveTextContent('DS Builder/Проекты/Platform/System/Brand/Цветовые токены');
        expect(breadcrumbs.querySelector('a[href="/projects/project-1"]')).toHaveTextContent('Platform');
        expect(breadcrumbs.querySelector('a[href="/projects/project-1/design-systems/ds-1"]')).toHaveTextContent(
            'System',
        );
        expect(screen.getByRole('button', { name: 'Настройки темы' })).toHaveClass('builder-rail-button');
        expect(screen.getByTestId('editor-nav-colors')).toBeInTheDocument();
        expect(view.container.querySelector('[data-testid="editor-nav-overview"]')).not.toBeInTheDocument();
        expect(screen.getAllByText('Цветовые токены').length).toBeGreaterThan(0);
        const rail = screen.getByTestId('editor-rail');
        fireEvent.click(screen.getByRole('button', { name: 'Настройки темы' }));
        expect(screen.getByTestId('editor-rail')).toBe(rail);
        expect(breadcrumbs).toHaveTextContent('DS Builder/Проекты/Platform/System/Brand/Настройки темы');
        expect(screen.getByText('Параметры темы')).toBeInTheDocument();
    });

    it('shows one centered loading indicator instead of the header spinner while the Theme loads', () => {
        hookState.loading = true;
        render(
            <MemoryRouter initialEntries={['/projects/project-1/design-systems/ds-1/themes/theme-1/colors']}>
                <Routes>
                    <Route
                        path="/projects/:projectId/design-systems/:designSystemId/themes/:tenantId"
                        element={<Main />}
                    >
                        <Route path="colors" element={<div />} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );

        // Один индикатор по центру холста; в шапке спиннера нет (ревью QA, PR #101).
        const loading = screen.getByRole('status');
        expect(loading).toHaveTextContent('Загружаем тему…');
        expect(loading.closest('header')).toBeNull();
        expect(screen.queryByRole('navigation', { name: 'Навигация темы' })).not.toBeInTheDocument();
        expect(screen.queryByText(/Загружаем Theme/)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Настройки темы' })).toBeInTheDocument();
    });

    it('shows «Сохранить» on the Theme route only when there is a local draft', () => {
        renderEditor();
        expect(screen.queryByText('Сохранить')).not.toBeInTheDocument();
        cleanup();

        localStorage.setItem(DRAFT_KEY, '{}');
        renderEditor();
        expect(screen.getByText('Сохранить')).toBeInTheDocument();
        expect(screen.queryByText('Опубликовать')).not.toBeInTheDocument();
    });

    it('saves, clears the draft and reloads', async () => {
        localStorage.setItem(DRAFT_KEY, '{}');
        mainUtils.designSystemSave.mockResolvedValueOnce({ editRevision: 2 });
        renderEditor();

        fireEvent.click(screen.getByText('Сохранить'));

        await waitFor(() => expect(reload).toHaveBeenCalledOnce());
        expect(mainUtils.designSystemSave).toHaveBeenCalledOnce();
        expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    });

    it('keeps the draft changed while the save was running', async () => {
        localStorage.setItem(DRAFT_KEY, '{}');
        mainUtils.designSystemSave.mockImplementationOnce(async () => {
            localStorage.setItem(DRAFT_KEY, '{"edited":true}');
            return { editRevision: 2 };
        });
        renderEditor();

        fireEvent.click(screen.getByText('Сохранить'));

        await waitFor(() => expect(reload).toHaveBeenCalledOnce());
        expect(localStorage.getItem(DRAFT_KEY)).toBe('{"edited":true}');
    });

    it('does not clear the draft of another tenant opened while the save was running', async () => {
        localStorage.setItem(DRAFT_KEY, '{}');
        const otherTenantKey = 'ds_draft:project-1:ds-1:theme-2';
        mainUtils.designSystemSave.mockImplementationOnce(async () => {
            setActiveDraftContext({ projectId: 'project-1', designSystemId: 'ds-1', tenantId: 'theme-2' });
            localStorage.setItem(otherTenantKey, '{}');
            return { editRevision: 2 };
        });
        renderEditor();

        fireEvent.click(screen.getByText('Сохранить'));

        await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).toBeNull());
        expect(localStorage.getItem(otherTenantKey)).toBe('{}');
        // Редактор уже на другом tenant: ответ прежнего не перезагружает его.
        expect(reload).not.toHaveBeenCalled();
    });

    it('binds the draft snapshot to its own save when another tenant is saved meanwhile', async () => {
        const otherTenantKey = 'ds_draft:project-1:ds-1:theme-2';
        let resolveFirst: (value: { editRevision: number }) => void = () => {};
        let resolveSecond: (value: { editRevision: number }) => void = () => {};
        mainUtils.designSystemSave
            .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
            .mockImplementationOnce(() => new Promise((resolve) => (resolveSecond = resolve)));

        // Сохранение темы A ещё идёт.
        localStorage.setItem(DRAFT_KEY, '{"a":1}');
        renderEditor();
        fireEvent.click(screen.getByText('Сохранить'));
        await screen.findByText('Сохраняем…');

        // Пользователь открыл тему B и запустил её сохранение: кнопка создана заново.
        cleanup();
        setActiveDraftContext({ projectId: 'project-1', designSystemId: 'ds-1', tenantId: 'theme-2' });
        localStorage.setItem(otherTenantKey, '{"b":1}');
        renderEditor();
        fireEvent.click(screen.getByText('Сохранить'));
        await screen.findByText('Сохраняем…');

        // Ответ A очищает только черновик A и не перезагружает редактор темы B.
        resolveFirst({ editRevision: 2 });
        await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).toBeNull());
        expect(localStorage.getItem(otherTenantKey)).toBe('{"b":1}');
        expect(reload).not.toHaveBeenCalled();

        // Ответ B очищает свой черновик и перезагружает редактор.
        resolveSecond({ editRevision: 3 });
        await waitFor(() => expect(reload).toHaveBeenCalledOnce());
        expect(localStorage.getItem(otherTenantKey)).toBeNull();
    });

    describe('component editor section', () => {
        const renderShell = () =>
            render(
                <MemoryRouter initialEntries={['/projects/project-1/design-systems/ds-1/themes/theme-1/colors']}>
                    <Routes>
                        <Route
                            path="/projects/:projectId/design-systems/:designSystemId/themes/:tenantId"
                            element={<Main />}
                        >
                            <Route path="colors" element={<div>Цветовые токены</div>} />
                        </Route>
                    </Routes>
                </MemoryRouter>,
            );

        it('offers the section when it is enabled and the design system has components', () => {
            vi.stubEnv('VITE_COMPONENT_EDITOR_ENABLED', 'true');
            hookState.components = [{}];

            renderShell();

            expect(screen.getByTestId('editor-nav-components')).toBeInTheDocument();
        });

        it('hides the section when it is disabled, even if the design system has components', () => {
            vi.stubEnv('VITE_COMPONENT_EDITOR_ENABLED', 'false');
            hookState.components = [{}];

            renderShell();

            expect(screen.queryByTestId('editor-nav-components')).not.toBeInTheDocument();
        });
    });
});
