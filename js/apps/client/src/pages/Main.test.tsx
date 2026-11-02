import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Suspense, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useOutletContext } from 'react-router-dom';

const { hookState, reload, mainUtils, retryAutosave } = vi.hoisted(() => ({
    hookState: {
        loading: false,
        components: [] as unknown[],
        hasComponents: false,
        autosaveStatus: 'saved' as 'saved' | 'saving' | 'error',
        sectionLoading: false,
        componentLoading: false,
    },
    reload: vi.fn(),
    retryAutosave: vi.fn(),
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
        hasConfiguredComponents: hookState.hasComponents,
        incompleteTokenIds: [],
        loadError: null,
        autosaveStatus: hookState.autosaveStatus,
        retryAutosave,
        lastSavedAt: 1_000,
        reload,
        sectionLoading: hookState.sectionLoading,
        componentLoading: hookState.componentLoading,
    }),
}));

vi.mock('../features/versionJournal/useJournal', () => ({
    useJournal: () => ({ actions: [], loading: false, error: undefined, reload: vi.fn() }),
    useReloadAfterAutosave: vi.fn(),
}));
vi.mock('../features/versionJournal/useJournalSummary', () => ({
    useJournalSummary: () => ({ total: 0, error: undefined, reload: vi.fn() }),
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
    hookState.hasComponents = false;
    hookState.autosaveStatus = 'saved';
    hookState.sectionLoading = false;
    hookState.componentLoading = false;
    localStorage.clear();
    vi.clearAllMocks();
    cleanup();
    vi.unstubAllEnvs();
});

describe('Theme editor shell', () => {
    it('does not retain the previous section while the next route is pending', async () => {
        let ready = false;
        let finish: () => void = () => undefined;
        const completion = new Promise<void>((resolve) => {
            finish = resolve;
        });
        const Settings = () => {
            if (!ready) throw completion;
            return <div>Новые настройки</div>;
        };
        render(
            <MemoryRouter initialEntries={['/projects/project-1/design-systems/ds-1/themes/theme-1/colors']}>
                <Suspense fallback={<div>Загрузка маршрута</div>}>
                    <Routes>
                        <Route
                            path="/projects/:projectId/design-systems/:designSystemId/themes/:tenantId"
                            element={<Main />}
                        >
                            <Route
                                path="colors"
                                element={<div data-testid="previous-section">Старое содержимое</div>}
                            />
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
        await act(async () => {
            ready = true;
            finish();
            await completion;
        });
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
            <MemoryRouter
                initialEntries={[
                    `/projects/project-1/design-systems/ds-1/themes/theme-1/${section}?versionId=published-1`,
                ]}
            >
                <Routes>
                    <Route
                        path="/projects/:projectId/design-systems/:designSystemId/themes/:tenantId"
                        element={<Main />}
                    >
                        <Route path="*" element={<div />} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );
        const breadcrumbs = screen.getByRole('navigation', { name: 'Навигация темы' });
        expect(breadcrumbs.querySelector('[aria-current="page"]')).toHaveTextContent(label);
        expect(screen.getByRole('link', { name: 'Brand' })).toHaveAttribute(
            'href',
            '/projects/project-1/design-systems/ds-1/themes/theme-1/colors?versionId=published-1',
        );
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
        expect(loading).toHaveAccessibleName('Загружаем тему…');
        expect(loading.closest('header')).toBeNull();
        expect(screen.queryByRole('navigation', { name: 'Навигация темы' })).not.toBeInTheDocument();
        expect(screen.queryByText(/Загружаем Theme/)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Настройки темы' })).toBeInTheDocument();
    });

    it('не показывает ручное сохранение даже при наличии прежнего локального черновика', () => {
        localStorage.setItem(DRAFT_KEY, '{}');
        renderEditor();
        expect(screen.queryByText('Сохранить')).not.toBeInTheDocument();
        expect(screen.queryByText('Опубликовать')).not.toBeInTheDocument();
        expect(mainUtils.designSystemSave).not.toHaveBeenCalled();
    });

    it('показывает состояние серверного сохранения вместо ручной кнопки', () => {
        hookState.autosaveStatus = 'saving';
        renderEditor();
        expect(screen.getByRole('status', { name: /Сохраняется/ })).toBeInTheDocument();
        expect(screen.queryByText('Сохранить')).not.toBeInTheDocument();
    });

    it('не очищает изменившийся локальный черновик при смене статуса серверной очереди', () => {
        localStorage.setItem(DRAFT_KEY, '{}');
        hookState.autosaveStatus = 'saving';
        const view = renderEditor();
        localStorage.setItem(DRAFT_KEY, '{"edited":true}');
        hookState.autosaveStatus = 'saved';
        view.rerender(
            <MemoryRouter>
                <Main />
            </MemoryRouter>,
        );
        expect(localStorage.getItem(DRAFT_KEY)).toBe('{"edited":true}');
        expect(mainUtils.designSystemSave).not.toHaveBeenCalled();
    });

    it('не очищает черновик соседней темы при отображении подтверждённого сохранения', () => {
        const other = 'ds_draft:project-1:ds-1:theme-2';
        localStorage.setItem(DRAFT_KEY, '{"a":1}');
        localStorage.setItem(other, '{"b":1}');
        renderEditor();
        expect(localStorage.getItem(DRAFT_KEY)).toBe('{"a":1}');
        expect(localStorage.getItem(other)).toBe('{"b":1}');
        expect(reload).not.toHaveBeenCalled();
    });

    it('повторяет только серверную очередь при ошибке, не вызывает прежний общий способ сохранения', () => {
        hookState.autosaveStatus = 'error';
        renderEditor();
        fireEvent.click(screen.getByRole('button', { name: 'Повторить сохранение' }));
        expect(retryAutosave).toHaveBeenCalledOnce();
        expect(mainUtils.designSystemSave).not.toHaveBeenCalled();
    });

    it('показывает время успешного сохранения в подсказке, без перезагрузки редактора', () => {
        renderEditor();
        fireEvent.mouseEnter(screen.getByRole('status', { name: /Последнее сохранение/ }));
        expect(screen.getByRole('tooltip')).toHaveTextContent('Последнее сохранение');
        expect(reload).not.toHaveBeenCalled();
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
            hookState.hasComponents = true;
            hookState.components = [];

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

    it('при смене компонента не размонтирует страницу раздела и передаёт ей загрузку компонента', () => {
        hookState.hasComponents = true;
        let mounts = 0;
        const ComponentsPage = () => {
            const { componentLoading } = useOutletContext<{ componentLoading?: boolean }>();
            useState(() => {
                mounts += 1;
                return mounts;
            });
            return <div data-testid="components-page">{componentLoading ? 'загрузка компонента' : 'компонент'}</div>;
        };
        const tree = () => (
            <MemoryRouter initialEntries={['/projects/project-1/design-systems/ds-1/themes/theme-1/components/Button']}>
                <Routes>
                    <Route path="/projects/:projectId/design-systems/:designSystemId/themes/:tenantId" element={<Main />}>
                        <Route path="components/:componentName" element={<ComponentsPage />} />
                    </Route>
                </Routes>
            </MemoryRouter>
        );
        const { rerender } = render(tree());
        const page = screen.getByTestId('components-page');

        hookState.componentLoading = true;
        rerender(tree());

        expect(screen.getByTestId('components-page')).toBe(page);
        expect(page).toHaveTextContent('загрузка компонента');
        expect(screen.queryByRole('status', { name: 'Открываем раздел' })).not.toBeInTheDocument();
        expect(mounts).toBe(1);
    });

    it('при загрузке раздела по-прежнему показывает общую загрузку вместо страницы', () => {
        hookState.sectionLoading = true;
        render(
            <MemoryRouter initialEntries={['/projects/project-1/design-systems/ds-1/themes/theme-1/components/Button']}>
                <Routes>
                    <Route path="/projects/:projectId/design-systems/:designSystemId/themes/:tenantId" element={<Main />}>
                        <Route path="components/:componentName" element={<div data-testid="components-page" />} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );

        expect(screen.queryByTestId('components-page')).not.toBeInTheDocument();
        expect(screen.getByRole('status', { name: 'Открываем раздел' })).toBeInTheDocument();
    });
});
