import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApiError, authService, designSystemsApi, projectsApi, type ProjectDto } from '../api';
import { getAnchoredPopoverGeometry } from '../components/Overlay/Overlay';
import { resetQueryCache } from '../shared/data/useLoad';
import {
    CreateDesignSystemPage,
    CreateProjectPage,
    CreateThemePage,
    DesignSystemPage,
    DesignSystemSettingsPage,
    ProjectPage,
    ProjectSettingsPage,
    ProjectsPage,
    ThemeSettingsPage,
} from './workflowPages';
import workflowCss from '../styles/workflow.css?raw';
import * as projectPages from './projects/Projects';
import * as designSystemPages from './designSystems/DesignSystems';
import * as themePages from './themes/Themes';
import builderShellSource from '../components/BuilderShell/BuilderShell.tsx?raw';
import projectPagesSource from './projects/Projects.tsx?raw';
import designSystemPagesSource from './designSystems/DesignSystems.tsx?raw';
import themePagesSource from './themes/Themes.tsx?raw';
import projectsCatalogSource from './projects/ProjectsCatalog.tsx?raw';
import designSystemOverviewSource from './designSystems/DesignSystemOverview.tsx?raw';
import themeSettingsSource from './themes/ThemeSettingsPage.tsx?raw';

const project = (role: ProjectDto['effectiveRole'], status: ProjectDto['status'] = 'active'): ProjectDto => ({
    id: 'project-1',
    name: 'Platform',
    description: 'Shared UI',
    status,
    ownerUserId: 'owner-1',
    ownerUsername: 'owner',
    ownerEmail: 'owner@example.com',
    ownerDisplayName: 'Owner User',
    effectiveRole: role,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
});
const at = (path: string, element: React.ReactNode) => {
    const route = path
        .replace('/projects/project-1', '/projects/:projectId')
        .replace('/design-systems/ds-1', '/design-systems/:designSystemId')
        .replace('/themes/theme-1', '/themes/:tenantId');
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path={route} element={element} />
            </Routes>
        </MemoryRouter>,
    );
};

beforeEach(() => {
    vi.restoreAllMocks();
    resetQueryCache();
    vi.spyOn(projectsApi, 'list').mockResolvedValue([]);
    vi.spyOn(projectsApi, 'accessKeys').mockResolvedValue([]);
    vi.spyOn(projectsApi, 'memberCandidates').mockResolvedValue([]);
    vi.spyOn(designSystemsApi, 'list').mockResolvedValue([]);
    vi.spyOn(designSystemsApi, 'tenants').mockResolvedValue([]);
    vi.spyOn(designSystemsApi, 'get').mockResolvedValue({
        id: 'ds-1',
        projectId: 'project-1',
        name: 'System',
        tenantCount: 0,
        themePreviews: [],
    });
});
afterEach(cleanup);

describe('project workflow', () => {
    it('anchors popovers to their trigger and clamps them inside small viewports', () => {
        expect(
            getAnchoredPopoverGeometry({
                anchor: { top: 119, right: 800, bottom: 143, left: 712, width: 88 },
                naturalHeight: 148,
                viewportWidth: 1280,
                viewportHeight: 720,
            }),
        ).toEqual({ left: 712, top: 147, width: 88, maxHeight: 565 });

        expect(
            getAnchoredPopoverGeometry({
                anchor: { top: 200, right: 100, bottom: 224, left: 60, width: 40 },
                naturalHeight: 500,
                preferredWidth: 168,
                viewportWidth: 100,
                viewportHeight: 300,
            }),
        ).toEqual({ left: 8, top: 8, width: 84, maxHeight: 188 });
    });

    it('exposes project, design-system, and theme routes through separate page modules', () => {
        expect(Object.keys(projectPages).sort()).toEqual([
            'CreateProjectPage',
            'ProjectPage',
            'ProjectSettingsPage',
            'ProjectsPage',
        ]);
        expect(Object.keys(designSystemPages).sort()).toEqual([
            'CreateDesignSystemPage',
            'DesignSystemCard',
            'DesignSystemPage',
            'DesignSystemSettingsPage',
        ]);
        expect(Object.keys(themePages).sort()).toEqual(['CreateThemePage', 'ThemeCard', 'ThemeSettingsPage']);
        expect(builderShellSource).not.toMatch(/export const \w+(?:Page|Screen)\s*=/);
        expect(projectPagesSource).toContain("export { ProjectsPage } from './ProjectsCatalog'");
        expect(designSystemPagesSource).toContain("export { DesignSystemPage } from './DesignSystemOverview'");
        expect(themePagesSource).toContain("export { ThemeSettingsPage } from './ThemeSettingsPage'");
        expect(projectsCatalogSource).toMatch(/export const ProjectsPage\s*=/);
        expect(designSystemOverviewSource).toMatch(/export const DesignSystemPage\s*=/);
        expect(themeSettingsSource).toMatch(/export const ThemeSettingsPage\s*=/);
        for (const pageSource of [projectPagesSource, designSystemPagesSource, themePagesSource]) {
            expect(pageSource).not.toContain('createElement(');
        }
    });
    it('renders prototype loading and error states inside the catalog shell', async () => {
        vi.spyOn(projectsApi, 'list').mockImplementation(() => new Promise(() => {}));
        const loading = at('/projects', <ProjectsPage />);
        expect(screen.getByText('Загружаем проекты…')).toBeInTheDocument();
        expect(loading.container.querySelector('.builder-shell .catalog-loading-grid.is-project')).toBeInTheDocument();
        cleanup();
        vi.spyOn(projectsApi, 'list').mockRejectedValue(new ApiError(500));
        const failed = at('/projects', <ProjectsPage />);
        expect(await screen.findByText('Не удалось загрузить данные')).toBeInTheDocument();
        expect(
            failed.container.querySelector(
                '.builder-shell .catalog-error-state.is-project img[src="/catalog/error-state.png"]',
            ),
        ).toBeInTheDocument();
    });

    it('keeps the prototype catalog shell and fixed card structure for desktop and responsive layouts', async () => {
        vi.spyOn(projectsApi, 'list').mockResolvedValue([project('owner')]);
        const view = at('/projects', <ProjectsPage />);

        expect(await screen.findByText('Platform')).toBeInTheDocument();
        expect(view.container.querySelector('.builder-shell > .builder-icon-sidebar')).toBeInTheDocument();
        expect(view.container.querySelector('.builder-hierarchy-bar + .catalog-view')).toBeInTheDocument();
        expect(view.container.querySelector('.catalog-card .catalog-project-identity-mark')).toBeInTheDocument();
        expect(view.container.querySelector('.catalog-card > .catalog-card-link > .catalog-body')).toBeInTheDocument();
    });

    it('keeps the catalog card and compact rail structure at a phone viewport', async () => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
        window.dispatchEvent(new Event('resize'));
        vi.spyOn(projectsApi, 'list').mockResolvedValue([project('owner')]);
        const view = at('/projects', <ProjectsPage />);
        expect(await screen.findByText('Platform')).toBeInTheDocument();
        expect(view.container.querySelector('.builder-icon-sidebar')).toBeInTheDocument();
        expect(view.container.querySelector('.catalog-grid > .catalog-card')).toBeInTheDocument();
        expect(workflowCss).toMatch(/@media\s*\(max-width:\s*760px\)/);
        expect(workflowCss).toMatch(
            /\.builder-shell\s*\{[^}]*grid-template-columns:\s*44px minmax\(0,\s*1fr\)/,
        );
        expect(workflowCss).toMatch(
            /@media\s*\(max-width:\s*760px\)\s*\{[\s\S]*?\.catalog-grid,\s*\.catalog-loading-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*330px\)/,
        );
        expect(getComputedStyle(view.container.querySelector('.builder-icon-sidebar')!).width).toBe('44px');
    });

    it('uses every prototype sort option and applies its real project order', async () => {
        vi.spyOn(projectsApi, 'list').mockResolvedValue([
            { ...project('owner'), updatedAt: '2026-01-01T00:00:00Z' },
            { ...project('viewer'), id: 'project-2', name: 'Alpha', updatedAt: '2026-02-01T00:00:00Z' },
        ]);
        at('/projects', <ProjectsPage />);
        await screen.findByText('Platform');
        expect(screen.queryByLabelText('Какие файлы показывать')).not.toBeInTheDocument();

        const headings = () => screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent);
        expect(headings()).toEqual(['Alpha', 'Platform']);

        fireEvent.click(screen.getByRole('button', { name: 'Недавно изменённые' }));
        fireEvent.click(screen.getByRole('menuitemradio', { name: 'Название А–Я' }));
        expect(screen.getByRole('button', { name: 'Название А–Я' })).toBeInTheDocument();
        expect(headings()).toEqual(['Alpha', 'Platform']);

        fireEvent.click(screen.getByRole('button', { name: 'Название А–Я' }));
        fireEvent.click(screen.getByRole('menuitemradio', { name: 'Название Я–А' }));
        expect(screen.getByRole('button', { name: 'Название Я–А' })).toBeInTheDocument();
        expect(headings()).toEqual(['Platform', 'Alpha']);
        expect(screen.getByRole('button', { name: 'Название Я–А' }).querySelector('svg.ui-glyph')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Название Я–А' }));
        fireEvent.click(screen.getByRole('menuitemradio', { name: 'Недавно изменённые' }));
        expect(screen.getByRole('button', { name: 'Недавно изменённые' })).toBeInTheDocument();
        expect(headings()).toEqual(['Alpha', 'Platform']);

        fireEvent.click(screen.getByRole('button', { name: 'Недавно изменённые' }));
        fireEvent.mouseDown(document.body);
        expect(screen.queryByRole('menuitemradio', { name: 'Название А–Я' })).not.toBeInTheDocument();
    });

    it('separates archived projects and shows the design-system count instead of description and status', async () => {
        vi.spyOn(projectsApi, 'list').mockResolvedValue([
            project('owner'),
            { ...project('owner', 'archived'), id: 'project-2', name: 'Archive', description: 'Legacy' },
        ]);
        vi.spyOn(designSystemsApi, 'list').mockResolvedValue([
            { id: 'base', projectId: 'project-1', name: 'base', isTechnical: true, tenantCount: 0, themePreviews: [] },
            { id: 'ds-1', projectId: 'project-1', name: 'System', tenantCount: 0, themePreviews: [] },
        ]);
        at('/projects', <ProjectsPage />);

        expect(await screen.findAllByText('1 дизайн-система')).toHaveLength(2);
        expect(screen.getByRole('heading', { name: 'Архивные' })).toBeInTheDocument();
        expect(screen.queryByText(/Shared UI|Legacy|Активный|Архивный/)).not.toBeInTheDocument();
    });

    it('shows registered-user suggestions by name and uses the selected identifier', async () => {
        vi.spyOn(projectsApi, 'memberCandidates').mockResolvedValue([
            { userId: 'user-2', username: 'alex', email: 'alex@example.com', displayName: 'Alex User' },
        ]);
        at('/projects/new', <CreateProjectPage />);
        fireEvent.change(await screen.findByLabelText('Название'), { target: { value: 'Platform' } });
        fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
        fireEvent.change(screen.getByPlaceholderText('Имя или корпоративная почта'), {
            target: { value: 'ale' },
        });

        expect(await screen.findByRole('option', { name: /Alex User/ })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('option', { name: /Alex User/ }));
        expect(screen.getByPlaceholderText('Имя или корпоративная почта')).toHaveValue('alex@example.com');
        fireEvent.click(screen.getByRole('button', { name: 'Очистить поиск участника' }));
        expect(screen.getByPlaceholderText('Имя или корпоративная почта')).toHaveValue('');
    });

    it('clamps long card titles and metadata inside one clipped card container', async () => {
        vi.spyOn(projectsApi, 'list').mockResolvedValue([
            {
                ...project('owner'),
                name: 'Очень длинное название проекта, которое не должно выходить за пределы карточки',
                description: 'Очень длинное описание проекта',
            },
        ]);
        const view = at('/projects', <ProjectsPage />);
        expect(await screen.findByRole('heading', { level: 2 })).toBeInTheDocument();
        expect(
            view.container.querySelector('.catalog-card > .catalog-card-link > .catalog-cover + .catalog-body'),
        ).toBeInTheDocument();
        expect(workflowCss).toMatch(/\.catalog-body h2 \{[\s\S]*?text-overflow: ellipsis;[\s\S]*?white-space: nowrap;/);
        expect(workflowCss).toMatch(/\.catalog-card \{[\s\S]*?overflow: hidden;[\s\S]*?border-radius: 12px;/);
    });

    it('keeps the selected project identity in the rail on a Design System route', async () => {
        vi.spyOn(projectsApi, 'get').mockResolvedValue({ ...project('owner'), name: 'Platform' });
        vi.spyOn(projectsApi, 'list').mockResolvedValue([
            { ...project('owner'), name: 'Platform' },
            { ...project('viewer'), id: 'project-2', name: 'Platform' },
        ]);
        vi.spyOn(designSystemsApi, 'get').mockResolvedValue({
            id: 'ds-1',
            projectId: 'project-1',
            name: 'System',
            tenantCount: 0,
            themePreviews: [],
        });
        vi.spyOn(designSystemsApi, 'tenants').mockResolvedValue([]);
        const view = at('/projects/project-1/design-systems/ds-1', <DesignSystemPage />);
        expect(await screen.findByText('Тем пока нет')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Темы' })).toBeInTheDocument();
        expect(await screen.findAllByRole('link', { name: 'Platform' })).toHaveLength(2);
        expect(
            view.container.querySelector('.rail-entity-item[href="/projects/project-1"] .builder-entity-initials'),
        ).toHaveTextContent('PL');
        expect(view.container.querySelectorAll('.builder-entity-list > .rail-entity-item')).toHaveLength(2);
        expect(view.container.querySelector('.rail-entity-item[href="/projects/project-1"]')).toHaveClass('is-active');
        expect(view.container.querySelector('.rail-entity-item[href="/projects/project-2"]')).not.toHaveClass(
            'is-active',
        );
    });

    it('keeps nested route context while a Design System is loading', async () => {
        vi.spyOn(projectsApi, 'get').mockResolvedValue({ ...project('owner'), name: 'Platform' });
        vi.spyOn(projectsApi, 'list').mockResolvedValue([{ ...project('owner'), name: 'Platform' }]);
        vi.spyOn(designSystemsApi, 'get').mockImplementation(() => new Promise(() => {}));
        vi.spyOn(designSystemsApi, 'tenants').mockImplementation(() => new Promise(() => {}));
        const view = at('/projects/project-1/design-systems/ds-1', <DesignSystemPage />);
        expect(await screen.findByText('Загружаем темы…')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Темы' })).toBeInTheDocument();
        expect(view.container.querySelector('.catalog-loading-grid.is-theme')).toBeInTheDocument();
        expect(await screen.findByRole('link', { name: 'Platform' })).toHaveClass('is-active');
    });

    it('keeps cached parent composition and does not flash a loading grid during nested navigation', async () => {
        vi.spyOn(projectsApi, 'get').mockResolvedValue(project('owner'));
        vi.spyOn(projectsApi, 'list').mockResolvedValue([project('owner')]);
        vi.spyOn(designSystemsApi, 'list').mockResolvedValue([
            { id: 'ds-1', projectId: 'project-1', name: 'System', tenantCount: 0, themePreviews: [] },
        ]);
        vi.spyOn(designSystemsApi, 'tenants').mockImplementation(() => new Promise(() => {}));
        const view = render(
            <MemoryRouter initialEntries={['/projects/project-1']}>
                <Routes>
                    <Route path="/projects/:projectId" element={<ProjectPage />} />
                    <Route path="/projects/:projectId/design-systems/:designSystemId" element={<DesignSystemPage />} />
                </Routes>
            </MemoryRouter>,
        );
        fireEvent.click(await screen.findByRole('link', { name: /System/ }));
        expect(await screen.findByRole('heading', { name: 'Темы' })).toBeInTheDocument();
        expect(view.container.querySelector('.catalog-loading-grid')).not.toBeInTheDocument();
        expect(screen.getByTestId('themes-catalog-preserved')).toHaveAttribute('aria-busy', 'true');
    });

    it('keeps the project composition without a full-page skeleton when entering from projects', async () => {
        vi.spyOn(projectsApi, 'list').mockResolvedValue([project('owner')]);
        vi.spyOn(projectsApi, 'get').mockImplementation(() => new Promise(() => {}));
        vi.spyOn(designSystemsApi, 'list').mockImplementation(() => new Promise(() => {}));
        const view = render(
            <MemoryRouter initialEntries={['/projects']}>
                <Routes>
                    <Route path="/projects" element={<ProjectsPage />} />
                    <Route path="/projects/:projectId" element={<ProjectPage />} />
                </Routes>
            </MemoryRouter>,
        );
        await screen.findByText('Platform');
        fireEvent.click(view.container.querySelector('[data-testid="projects-catalog-cards"] a')!);
        expect(await screen.findByRole('heading', { name: 'Дизайн-системы' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Настройки проекта' })).toBeInTheDocument();
        expect(view.container.querySelector('.catalog-loading-grid')).not.toBeInTheDocument();
        expect(screen.getByTestId('systems-catalog-preserved')).toHaveAttribute('aria-busy', 'true');
    });

    it('never carries owner data or actions across a projectId route change', async () => {
        const owner = { ...project('owner'), name: 'Owner project' };
        const viewer = { ...project('viewer'), id: 'project-2', name: 'Viewer project' };
        vi.spyOn(projectsApi, 'list').mockResolvedValue([owner, viewer]);
        vi.spyOn(projectsApi, 'get').mockImplementation(async (id) => (id === 'project-1' ? owner : viewer));
        vi.spyOn(designSystemsApi, 'list').mockResolvedValue([]);
        render(
            <MemoryRouter initialEntries={['/projects/project-1']}>
                <Routes>
                    <Route path="/projects/:projectId" element={<ProjectPage />} />
                </Routes>
            </MemoryRouter>,
        );
        expect(await screen.findByRole('link', { name: 'Настройки проекта' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('link', { name: 'Viewer project' }));
        await waitFor(() => expect(screen.getByText('Viewer project')).toBeInTheDocument());
        expect(screen.queryByRole('link', { name: 'Настройки проекта' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Создать систему' })).not.toBeInTheDocument();
        expect(screen.queryByText('Owner project')).not.toBeInTheDocument();
    });

    it('never carries one design system across a designSystemId route change', async () => {
        vi.spyOn(projectsApi, 'get').mockResolvedValue(project('owner'));
        vi.spyOn(projectsApi, 'list').mockResolvedValue([project('owner')]);
        vi.spyOn(designSystemsApi, 'get').mockImplementation(async (_projectId, id) => ({
            id,
            projectId: 'project-1',
            name: id === 'ds-1' ? 'System One' : 'System Two',
            tenantCount: 0,
            themePreviews: [],
        }));
        vi.spyOn(designSystemsApi, 'tenants').mockResolvedValue([]);
        render(
            <MemoryRouter initialEntries={['/projects/project-1/design-systems/ds-1']}>
                <Link to="/projects/project-1/design-systems/ds-2">Switch system</Link>
                <Routes>
                    <Route path="/projects/:projectId/design-systems/:designSystemId" element={<DesignSystemPage />} />
                </Routes>
            </MemoryRouter>,
        );
        expect(await screen.findByText('System One')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('link', { name: 'Switch system' }));
        expect(screen.queryByText('System One')).not.toBeInTheDocument();
        expect(await screen.findByText('System Two')).toBeInTheDocument();
    });

    it('clears cached catalog data on logout and exposes a failed reauthorization request', async () => {
        vi.spyOn(projectsApi, 'list').mockResolvedValue([project('owner')]);
        at('/projects', <ProjectsPage />);
        expect(await screen.findByText('Platform')).toBeInTheDocument();
        cleanup();
        await authService.logout();
        vi.spyOn(projectsApi, 'list').mockRejectedValue(new ApiError(403));
        at('/projects', <ProjectsPage />);
        expect(await screen.findByText('Не удалось загрузить данные')).toBeInTheDocument();
        expect(screen.queryByText('Platform')).not.toBeInTheDocument();
    });

    it('does not hide a background authorization failure behind cached data', async () => {
        vi.spyOn(projectsApi, 'list').mockResolvedValue([project('owner')]);
        at('/projects', <ProjectsPage />);
        expect(await screen.findByText('Platform')).toBeInTheDocument();
        cleanup();
        vi.spyOn(projectsApi, 'list').mockRejectedValue(new ApiError(403));
        at('/projects', <ProjectsPage />);
        expect(screen.getByText('Platform')).toBeInTheDocument();
        expect(await screen.findByText('Не удалось загрузить данные')).toBeInTheDocument();
        expect(screen.queryByText('Platform')).not.toBeInTheDocument();
    });

    it('retries every request used by a failed Design System catalog', async () => {
        const loadProject = vi.spyOn(projectsApi, 'get').mockRejectedValue(new ApiError(500));
        vi.spyOn(projectsApi, 'list').mockResolvedValue([project('owner')]);
        const loadSystem = vi.spyOn(designSystemsApi, 'get').mockRejectedValue(new ApiError(500));
        const loadThemes = vi.spyOn(designSystemsApi, 'tenants').mockRejectedValue(new ApiError(500));
        at('/projects/project-1/design-systems/ds-1', <DesignSystemPage />);
        fireEvent.click(await screen.findByRole('button', { name: 'Повторить' }));
        await waitFor(() => {
            expect(loadProject).toHaveBeenCalledTimes(2);
            expect(loadSystem).toHaveBeenCalledTimes(2);
            expect(loadThemes).toHaveBeenCalledTimes(2);
        });
    });

    it('shows the project creation action when the authenticated user has no projects', async () => {
        vi.spyOn(projectsApi, 'list').mockResolvedValue([]);
        at('/projects', <ProjectsPage />);

        expect(await screen.findByText('Проектов пока нет')).toBeInTheDocument();
        expect(screen.getAllByRole('link', { name: 'Создать проект' })).toHaveLength(2);
    });

    it('creates a project before assigning registered members from step two', async () => {
        const create = vi.spyOn(projectsApi, 'create').mockResolvedValue(project('owner'));
        const addMember = vi.spyOn(projectsApi, 'addMember').mockResolvedValue({
            userId: 'member-1',
            role: 'editor',
            createdAt: '',
            updatedAt: '',
        });
        at('/projects/new', <CreateProjectPage />);
        expect(await screen.findByText('Проект')).toBeInTheDocument();
        expect(screen.getByText('Команда')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Название'), { target: { value: '  Platform  ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
        expect(screen.getByText('Добавьте зарегистрированных пользователей и назначьте им роль.')).toBeInTheDocument();
        fireEvent.change(screen.getByPlaceholderText('Имя или корпоративная почта'), {
            target: { value: 'member@example.com' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Роль' }));
        fireEvent.click(screen.getByRole('option', { name: 'Editor' }));
        fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));
        expect(screen.getByText('member@example.com')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Создать проект' }));
        await waitFor(() => expect(create).toHaveBeenCalledWith({ name: 'Platform', description: undefined }));
        expect(addMember).toHaveBeenCalledWith('project-1', { email: 'member@example.com', role: 'editor' });
    });

    it('retries only failed membership assignments after the project already exists', async () => {
        const create = vi.spyOn(projectsApi, 'create').mockResolvedValue(project('owner'));
        const addMember = vi
            .spyOn(projectsApi, 'addMember')
            .mockResolvedValueOnce({ userId: 'ok', role: 'viewer', createdAt: '', updatedAt: '' })
            .mockRejectedValueOnce(new ApiError(404, 'registered_user_not_found'))
            .mockResolvedValueOnce({ userId: 'retry', role: 'editor', createdAt: '', updatedAt: '' });
        at('/projects/new', <CreateProjectPage />);
        fireEvent.change(await screen.findByLabelText('Название'), { target: { value: 'Platform' } });
        fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
        const add = (email: string, role: string) => {
            fireEvent.change(screen.getByPlaceholderText('Имя или корпоративная почта'), { target: { value: email } });
            fireEvent.click(screen.getByRole('button', { name: 'Роль' }));
            fireEvent.click(screen.getByRole('option', { name: role.charAt(0).toUpperCase() + role.slice(1) }));
            fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));
        };
        add('ok@example.com', 'viewer');
        add('retry@example.com', 'editor');
        fireEvent.click(screen.getByRole('button', { name: 'Создать проект' }));
        expect(await screen.findByText(/Проект создан. Не удалось добавить некоторых участников/)).toBeInTheDocument();
        expect(screen.queryByText('ok@example.com')).not.toBeInTheDocument();
        expect(screen.getByText('retry@example.com')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Повторить назначение' }));
        await waitFor(() => expect(addMember).toHaveBeenCalledTimes(3));
        expect(create).toHaveBeenCalledTimes(1);
        expect(addMember).toHaveBeenLastCalledWith('project-1', { email: 'retry@example.com', role: 'editor' });
    });

    it('keeps project catalog cards beneath the create-project modal', async () => {
        vi.spyOn(projectsApi, 'list').mockResolvedValue([project('owner')]);
        const view = at('/projects/new', <CreateProjectPage />);

        expect(await screen.findByRole('dialog', { name: 'Создать проект' })).toBeInTheDocument();
        expect(view.container.querySelector('[data-testid="projects-catalog-cards"] .catalog-card')).toHaveTextContent(
            'Platform',
        );
        expect(screen.getByRole('button', { name: 'Далее' })).toBeDisabled();
        expect(workflowCss).toMatch(/\.create-project-dialog\.is-team\s*\{[^}]*height:\s*auto;[^}]*max-height:/);
        expect(workflowCss).toMatch(/\.create-project-members\s*>\s*div\s*\{[^}]*overflow-y:\s*auto;/);
        expect(workflowCss).toMatch(
            /\.create-project-member-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+108px\s+24px;/,
        );
        expect(workflowCss).toMatch(
            /@media\s*\(max-width:\s*760px\)[\s\S]*?\.create-project-member-add\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
        );
    });

    it.each(['viewer', 'editor'] as const)(
        'hides project mutation actions from %s',
        async (role: 'viewer' | 'editor') => {
            vi.spyOn(projectsApi, 'get').mockResolvedValue(project(role));
            vi.spyOn(designSystemsApi, 'list').mockResolvedValue([]);
            at('/projects/project-1', <ProjectPage />);
            expect(await screen.findByText('Дизайн-систем пока нет')).toBeInTheDocument();
            expect(screen.getByRole('heading', { name: 'Дизайн-системы' })).toBeInTheDocument();
            expect(screen.queryByText('Настройки')).not.toBeInTheDocument();
            expect(screen.queryByText('Создать систему')).not.toBeInTheDocument();
        },
    );

    it('shows no-access state on a direct settings route and sends no mutation', async () => {
        vi.spyOn(projectsApi, 'get').mockResolvedValue(project('viewer'));
        vi.spyOn(projectsApi, 'members').mockResolvedValue([]);
        const update = vi.spyOn(projectsApi, 'update');
        at('/projects/project-1/settings', <ProjectSettingsPage />);
        expect(await screen.findByText('Нет доступа')).toBeInTheDocument();
        expect(update).not.toHaveBeenCalled();
    });

    it('preserves a 403 load error as the no-access state on a direct settings route', async () => {
        vi.spyOn(projectsApi, 'get').mockRejectedValue(new ApiError(403));
        vi.spyOn(projectsApi, 'members').mockResolvedValue([]);
        const update = vi.spyOn(projectsApi, 'update');
        at('/projects/project-1/settings', <ProjectSettingsPage />);
        expect(await screen.findByText('Нет доступа')).toBeInTheDocument();
        expect(update).not.toHaveBeenCalled();
    });

    it('disables archived project changes except owner restore', async () => {
        vi.spyOn(projectsApi, 'get').mockResolvedValue(project('owner', 'archived'));
        vi.spyOn(projectsApi, 'members').mockResolvedValue([]);
        at('/projects/project-1/settings', <ProjectSettingsPage />);
        expect(await screen.findByText(/Изменяющие действия отключены/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Восстановить проект' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Сохранить' })).not.toBeInTheDocument();
    });

    it('manages registered members with non-owner roles and confirmation on removal', async () => {
        vi.spyOn(projectsApi, 'get').mockResolvedValue(project('maintainer'));
        const memberList = vi.spyOn(projectsApi, 'members').mockResolvedValue([
            {
                userId: '68c8e6a9-b1b7-48db-ab93-350cd2eea3bd',
                username: 'alex',
                email: 'alex@example.com',
                displayName: 'Alex User',
                role: 'viewer',
                createdAt: '',
                updatedAt: '',
            },
        ]);
        const add = vi
            .spyOn(projectsApi, 'addMember')
            .mockResolvedValue({ userId: 'editor-1', role: 'editor', createdAt: '', updatedAt: '' });
        const remove = vi.spyOn(projectsApi, 'removeMember').mockResolvedValue();
        const view = at('/projects/project-1/settings', <ProjectSettingsPage />);
        expect(await screen.findByRole('heading', { name: 'Данные проекта' })).toBeInTheDocument();
        expect(screen.queryByText('Иконка проекта')).not.toBeInTheDocument();
        expect(screen.queryByText('Обложка проекта')).not.toBeInTheDocument();
        expect(screen.queryByText(/Загрузить (изображение|обложку)/)).not.toBeInTheDocument();
        fireEvent.click(await screen.findByRole('button', { name: 'Участники и роли' }));
        expect(view.container.querySelector('.ps-content')).toHaveAttribute('data-active-section', 'members');
        expect(view.container.querySelector('.ps-aside-header')).toHaveTextContent('ДоступPlatform');
        expect(view.container.querySelector('#settings-general')).not.toBeVisible();
        expect(view.container.querySelector('#settings-members')).toBeVisible();
        expect(screen.getByRole('button', { name: 'Роль владельца' })).toBeDisabled();
        expect(view.container.querySelector('.ps-search .ui-glyph')).toBeInTheDocument();
        expect(view.container.querySelector('.ps-search')).not.toHaveTextContent('⌕');
        expect(workflowCss).toMatch(/\.settings-section \.ps-search input[^}]*padding:\s*4px 30px/);
        expect(screen.getByText('Alex User')).toBeInTheDocument();
        expect(screen.getByText('alex · alex@example.com')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Найти участника'), { target: { value: 'alex@example.com' } });
        expect(screen.getByText('Alex User')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Очистить поиск участников' }));
        expect(screen.getByLabelText('Найти участника')).toHaveValue('');
        fireEvent.click(screen.getByRole('button', { name: 'Фильтр по роли' }));
        const roleFilter = screen.getByRole('listbox', { name: 'Фильтр по роли' });
        expect(roleFilter.parentElement).toBe(document.body);
        expect(roleFilter).toHaveStyle({ width: '116px' });
        expect(screen.getByRole('option', { name: 'Все роли' })).toHaveFocus();
        fireEvent.keyDown(roleFilter, { key: 'End' });
        expect(screen.getByRole('option', { name: 'Maintainer' })).toHaveFocus();
        fireEvent.keyDown(roleFilter, { key: 'Escape' });
        await waitFor(() => expect(screen.getByRole('button', { name: 'Фильтр по роли' })).toHaveFocus());
        fireEvent.click(screen.getByRole('button', { name: 'Фильтр по роли' }));
        expect(screen.getAllByRole('option').every((option) => option.getAttribute('tabindex') === '-1')).toBe(true);
        fireEvent.keyDown(screen.getByRole('listbox', { name: 'Фильтр по роли' }), { key: 'Tab' });
        await waitFor(() => expect(screen.getByRole('button', { name: /Роль участника/ })).toHaveFocus());
        expect(screen.getByRole('button', { name: 'Фильтр по роли' })).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(screen.getByRole('button', { name: 'Фильтр по роли' }));
        fireEvent.click(screen.getByRole('option', { name: 'Owner' }));
        expect(screen.getByText('Owner User')).toBeInTheDocument();
        expect(screen.getByText('owner · owner@example.com')).toBeInTheDocument();
        expect(screen.queryByText('Alex User')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Фильтр по роли' }));
        expect(screen.getByRole('listbox', { name: 'Фильтр по роли' })).toHaveStyle({ width: '116px' });
        fireEvent.click(screen.getByRole('option', { name: 'Все роли' }));
        expect(screen.getAllByRole('button', { name: 'Добавить участника' })).toHaveLength(1);
        fireEvent.click(screen.getByRole('button', { name: 'Добавить участника' }));
        expect(screen.getByRole('dialog', { name: 'Добавить участника' })).toBeInTheDocument();
        expect(view.container.querySelector('.ps-add-member-form')).not.toBeInTheDocument();
        fireEvent.change(await screen.findByPlaceholderText('Имя или корпоративная почта'), {
            target: { value: 'editor@example.com' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Роль нового участника' }));
        fireEvent.click(screen.getByRole('option', { name: 'Editor' }));
        fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));
        await waitFor(() =>
            expect(add).toHaveBeenCalledWith('project-1', { email: 'editor@example.com', role: 'editor' }),
        );
        await waitFor(() =>
            expect(screen.queryByRole('dialog', { name: 'Добавить участника' })).not.toBeInTheDocument(),
        );
        const memberRoleButton = screen.getByRole('button', {
            name: 'Роль участника 68c8e6a9-b1b7-48db-ab93-350cd2eea3bd',
        });
        fireEvent.click(memberRoleButton);
        const memberRolePopup = screen.getByRole('listbox', {
            name: 'Роль участника 68c8e6a9-b1b7-48db-ab93-350cd2eea3bd',
        });
        expect(memberRolePopup).toHaveStyle({ width: '136px' });
        expect(screen.getByRole('option', { name: 'Maintainer' })).toBeInTheDocument();
        fireEvent.keyDown(memberRolePopup, { key: 'Escape' });
        fireEvent.click(
            screen.getByRole('button', {
                name: 'Действия участника 68c8e6a9-b1b7-48db-ab93-350cd2eea3bd',
            }),
        );
        await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Удалить из проекта' })).toHaveFocus());
        expect(document.body.querySelector('.ps-member-actions-popover')).toBeInTheDocument();
        expect(view.container.querySelector('.ps-member-menu > .card-dropdown')).not.toBeInTheDocument();
        fireEvent.keyDown(screen.getByRole('menu'), { key: 'Tab' });
        await waitFor(() =>
            expect(screen.queryByRole('menuitem', { name: 'Удалить из проекта' })).not.toBeInTheDocument(),
        );
        expect(
            screen.getByRole('button', {
                name: 'Действия участника 68c8e6a9-b1b7-48db-ab93-350cd2eea3bd',
            }),
        ).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(
            screen.getByRole('button', {
                name: 'Действия участника 68c8e6a9-b1b7-48db-ab93-350cd2eea3bd',
            }),
        );
        fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
        expect(screen.queryByRole('menuitem', { name: 'Удалить из проекта' })).not.toBeInTheDocument();
        await waitFor(() =>
            expect(
                screen.getByRole('button', {
                    name: 'Действия участника 68c8e6a9-b1b7-48db-ab93-350cd2eea3bd',
                }),
            ).toHaveFocus(),
        );
        fireEvent.click(
            screen.getByRole('button', {
                name: 'Действия участника 68c8e6a9-b1b7-48db-ab93-350cd2eea3bd',
            }),
        );
        const removeMenuItem = screen.getByRole('menuitem', { name: 'Удалить из проекта' });
        fireEvent.blur(removeMenuItem, { relatedTarget: null });
        fireEvent.click(removeMenuItem);
        const removeDialog = screen.getByRole('dialog', { name: 'Удалить участника' });
        expect(removeDialog).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Закрыть' })).toHaveFocus();
        fireEvent.keyDown(screen.getByRole('button', { name: 'Закрыть' }), { key: 'Tab', shiftKey: true });
        expect(screen.getByRole('button', { name: 'Удалить' })).toHaveFocus();
        fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
        expect(screen.queryByRole('dialog', { name: 'Удалить участника' })).not.toBeInTheDocument();
        expect(remove).not.toHaveBeenCalled();
        await waitFor(() =>
            expect(
                screen.getByRole('button', {
                    name: 'Действия участника 68c8e6a9-b1b7-48db-ab93-350cd2eea3bd',
                }),
            ).toHaveFocus(),
        );
        fireEvent.click(
            screen.getByRole('button', {
                name: 'Действия участника 68c8e6a9-b1b7-48db-ab93-350cd2eea3bd',
            }),
        );
        fireEvent.click(screen.getByRole('menuitem', { name: 'Удалить из проекта' }));
        remove.mockRejectedValueOnce(new Error('network'));
        fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось удалить участника');
        expect(screen.getByRole('dialog', { name: 'Удалить участника' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
        await waitFor(() => expect(remove).toHaveBeenCalledWith('project-1', '68c8e6a9-b1b7-48db-ab93-350cd2eea3bd'));
        await waitFor(() =>
            expect(screen.queryByRole('dialog', { name: 'Удалить участника' })).not.toBeInTheDocument(),
        );
        expect(memberList).toHaveBeenCalledTimes(3);
        expect(screen.queryByRole('option', { name: 'Owner' })).not.toBeInTheDocument();
    });

    it('lists, creates, reveals once, and revokes project access keys through the existing API', async () => {
        vi.spyOn(projectsApi, 'get').mockResolvedValue(project('owner'));
        vi.spyOn(projectsApi, 'members').mockResolvedValue([]);
        vi.spyOn(projectsApi, 'accessKeys').mockResolvedValue([
            {
                id: 'key-1',
                projectId: 'project-1',
                name: 'CI',
                scopes: ['projects:read'],
                createdByUserId: 'owner-1',
                expiresAt: null,
                revokedAt: null,
                lastUsedAt: null,
                createdAt: '',
                updatedAt: '',
            },
        ]);
        const create = vi.spyOn(projectsApi, 'createAccessKey').mockResolvedValue({
            key: {
                id: 'key-2',
                projectId: 'project-1',
                name: 'Production',
                scopes: ['projects:read'],
                createdByUserId: 'owner-1',
                expiresAt: null,
                revokedAt: null,
                lastUsedAt: null,
                createdAt: '',
                updatedAt: '',
            },
            secret: 'dsb_pk_secret',
        });
        const revoke = vi.spyOn(projectsApi, 'revokeAccessKey').mockResolvedValue({
            id: 'key-1',
            projectId: 'project-1',
            name: 'CI',
            scopes: ['projects:read'],
            createdByUserId: 'owner-1',
            expiresAt: null,
            revokedAt: 'now',
            lastUsedAt: null,
            createdAt: '',
            updatedAt: '',
        });
        at('/projects/project-1/settings', <ProjectSettingsPage />);
        fireEvent.click(await screen.findByRole('button', { name: 'Администрирование' }));
        expect(await screen.findByText('CI')).toBeInTheDocument();
        expect(screen.getByText('projects:read')).toHaveClass('ps-scope-chip');
        expect(screen.getByText('projects:read').parentElement).toHaveClass('ps-scope-flow');
        expect(document.querySelector('.ps-cli-head')).toHaveTextContent('НазваниеСтатусScopesСрок действияДействия');
        expect(document.querySelector('.ps-aside-header')).toHaveTextContent('АдминистрированиеPlatform');
        expect(document.querySelector('.ps-aside-lifecycle')).toHaveTextContent('Активные ключи1');
        fireEvent.click(screen.getAllByRole('button', { name: 'Создать ключ' }).at(-1)!);
        expect(screen.getByRole('dialog', { name: 'Создать ключ доступа' })).toBeInTheDocument();
        expect(screen.getByRole('dialog', { name: 'Создать ключ доступа' })).toHaveClass('ps-access-key-dialog');
        expect(document.querySelector('.ps-access-key-modal-body')).toBeInTheDocument();
        expect(document.querySelector('.ps-scope-options')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Отмена' })).toBeInTheDocument();
        expect(workflowCss).toMatch(/\.ps-access-key-modal-body[^}]*overflow:\s*hidden/);
        expect(workflowCss).toMatch(/\.ps-scope-options[^}]*overflow-y:\s*auto/);
        expect(workflowCss).toMatch(/\.modal\.ps-access-key-dialog[^}]*height:\s*min/);
        expect(document.querySelectorAll('.ps-scope-option input[type="checkbox"]').length).toBeGreaterThan(1);
        fireEvent.change(screen.getByPlaceholderText('Например, CI production'), { target: { value: 'Production' } });
        fireEvent.click(screen.getAllByRole('button', { name: 'Создать ключ' }).at(-1)!);
        await waitFor(() =>
            expect(create).toHaveBeenCalledWith('project-1', {
                name: 'Production',
                scopes: ['projects:read'],
                ttlSeconds: 7776000,
            }),
        );
        expect(await screen.findByText('dsb_pk_secret')).toBeInTheDocument();
        expect(screen.getByText('Сохраните этот ключ. Он отображается всего один раз.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Копировать ключ' })).toBeInTheDocument();
        expect(screen.queryByText('members:read')).not.toBeInTheDocument();
        expect(screen.queryByText('Журнал аудита')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Готово' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Отозвать' }));
        await waitFor(() => expect(revoke).toHaveBeenCalledWith('project-1', 'key-1'));
    });

    it('allows Maintainer to list, create, and revoke access keys without owner lifecycle controls', async () => {
        vi.spyOn(projectsApi, 'get').mockResolvedValue(project('maintainer'));
        vi.spyOn(projectsApi, 'members').mockResolvedValue([]);
        vi.spyOn(projectsApi, 'accessKeys').mockResolvedValue([
            {
                id: 'key-1',
                projectId: 'project-1',
                name: 'Maintainer CI',
                scopes: ['projects:read'],
                createdByUserId: 'maintainer-1',
                expiresAt: null,
                revokedAt: null,
                lastUsedAt: null,
                createdAt: '',
                updatedAt: '',
            },
        ]);
        const create = vi.spyOn(projectsApi, 'createAccessKey').mockResolvedValue({
            key: {
                id: 'key-2',
                projectId: 'project-1',
                name: 'Maintainer production',
                scopes: ['projects:read'],
                createdByUserId: 'maintainer-1',
                expiresAt: null,
                revokedAt: null,
                lastUsedAt: null,
                createdAt: '',
                updatedAt: '',
            },
            secret: 'dsb_pk_maintainer',
        });
        const revoke = vi.spyOn(projectsApi, 'revokeAccessKey').mockResolvedValue({
            id: 'key-1',
            projectId: 'project-1',
            name: 'Maintainer CI',
            scopes: ['projects:read'],
            createdByUserId: 'maintainer-1',
            expiresAt: null,
            revokedAt: 'now',
            lastUsedAt: null,
            createdAt: '',
            updatedAt: '',
        });
        at('/projects/project-1/settings', <ProjectSettingsPage />);
        fireEvent.click(await screen.findByRole('button', { name: 'Администрирование' }));
        expect(await screen.findByText('Maintainer CI')).toBeInTheDocument();
        expect(screen.queryByText('Опасная зона')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Создать ключ' }));
        fireEvent.change(screen.getByPlaceholderText('Например, CI production'), {
            target: { value: 'Maintainer production' },
        });
        fireEvent.click(screen.getAllByRole('button', { name: 'Создать ключ' }).at(-1)!);
        await waitFor(() => expect(create).toHaveBeenCalled());
        fireEvent.click(screen.getByRole('button', { name: 'Отозвать' }));
        await waitFor(() => expect(revoke).toHaveBeenCalledWith('project-1', 'key-1'));
    });

    it('locks review styling for rail links, primary actions, and danger hover states', () => {
        expect(workflowCss).toMatch(/\.rail-entity-item\s*\{[\s\S]*?text-decoration:\s*none/);
        expect(workflowCss).toMatch(/\.catalog-primary-action\s*\{[\s\S]*?background:\s*var\(--p-accent\)/);
        expect(workflowCss).toMatch(/\.ps-button-danger:hover:not\(:disabled\)[\s\S]*?background:\s*#bd3545/);
    });
});

describe('design system and Theme workflow', () => {
    it('uses the prototype single-screen Theme panel and responsive preview composition', async () => {
        vi.spyOn(projectsApi, 'get').mockResolvedValue(project('editor'));
        const view = at('/projects/project-1/design-systems/ds-1/themes/new', <CreateThemePage />);

        expect(await screen.findByText('Стартовая палитра')).toBeInTheDocument();
        expect(view.container.querySelector('.create-theme-workspace > .create-theme-panel')).toBeInTheDocument();
        expect(view.container.querySelector('.create-theme-workspace > .theme-live-preview')).toBeInTheDocument();
        const columns = view.container.querySelectorAll('.create-theme-preview-grid > .create-theme-preview-column');
        expect(columns).toHaveLength(3);
        expect(columns[0].querySelectorAll(':scope > article')).toHaveLength(3);
        expect(columns[1].querySelectorAll(':scope > article')).toHaveLength(4);
        expect(columns[2].querySelectorAll(':scope > article')).toHaveLength(4);
        expect(view.container.querySelector('.preview-card-dynamics .preview-bars')).toBeInTheDocument();
        expect(view.container.querySelector('.preview-card-investment .preview-input')).toBeInTheDocument();
        expect(view.container.querySelector('.preview-empty')).toHaveTextContent('Создать трек');
        expect(view.container.querySelector('.preview-card-turnover svg')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Corporate Theme' } });
        expect(view.container.querySelector('.create-theme-preview-main > header strong')).toHaveTextContent(
            'Corporate Theme',
        );
        fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
        expect(view.container.querySelector('.create-theme-preview-note')).toHaveTextContent(
            'Параметры применяются сразу',
        );
        fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
        expect(view.container.querySelector('.create-theme-preview')).toHaveClass('is-dark');
        expect(screen.getByText(/Custom · Dark · Inter · 10/)).toBeInTheDocument();
    });

    it('renders tenant settings workspace and deletes only after exact-name confirmation', async () => {
        vi.spyOn(projectsApi, 'get').mockResolvedValue(project('maintainer'));
        vi.spyOn(designSystemsApi, 'tenants').mockResolvedValue([
            {
                id: 'theme-1',
                designSystemId: 'ds-1',
                name: 'Brand',
                editRevision: 0,
                colorConfig: { profile: 'sber' },
                preview: {
                    accentLight: '#108E26',
                    onAccentLight: '#fff',
                    surfaceLight: '#fff',
                    accentDark: '#1A9E32',
                    surfaceDark: '#101010',
                },
            },
        ]);
        const remove = vi.spyOn(designSystemsApi, 'removeTenant').mockResolvedValue();
        const view = at('/projects/project-1/design-systems/ds-1/themes/theme-1/settings', <ThemeSettingsPage />);
        expect(await screen.findByText('Параметры темы')).toBeInTheDocument();
        const breadcrumbs = view.container.querySelector('.builder-hierarchy-path')!;
        expect(breadcrumbs).toHaveTextContent('DS Builder/Проекты/Platform/System/Brand/Настройки');
        expect(breadcrumbs.querySelector('a[href="/projects/project-1"]')).toHaveTextContent('Platform');
        expect(breadcrumbs.querySelector('a[href="/projects/project-1/design-systems/ds-1"]')).toHaveTextContent(
            'System',
        );
        expect(
            breadcrumbs.querySelector('a[href="/projects/project-1/design-systems/ds-1/themes/theme-1/overview"]'),
        ).toHaveTextContent('Brand');
        expect(view.container.querySelector('.project-settings > .ps-nav')).toBeInTheDocument();
        expect(screen.getByText('Название отображается в списке тем и в верхней панели.')).toHaveClass(
            'theme-name-hint',
        );
        fireEvent.click(screen.getByRole('button', { name: 'Удаление' }));
        expect(screen.getByText('Параметры темы')).not.toBeVisible();
        expect(screen.queryByRole('link', { name: 'Готово' })).not.toBeInTheDocument();
        expect(screen.getByText('Опасная зона')).toHaveClass('ps-danger-title');
        const confirmation = screen.getByLabelText('Подтверждение удаления Theme');
        expect(screen.getByRole('button', { name: 'Удалить тему' })).toBeDisabled();
        fireEvent.change(confirmation, { target: { value: 'Brand' } });
        fireEvent.click(screen.getByRole('button', { name: 'Удалить тему' }));
        await waitFor(() => expect(remove).toHaveBeenCalledWith('project-1', 'theme-1'));
    });

    it('collapses settings composition safely at a phone viewport', async () => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
        window.dispatchEvent(new Event('resize'));
        vi.spyOn(projectsApi, 'get').mockResolvedValue(project('editor'));
        vi.spyOn(designSystemsApi, 'tenants').mockResolvedValue([
            {
                id: 'theme-1',
                designSystemId: 'ds-1',
                name: 'Brand',
                editRevision: 0,
                colorConfig: { profile: 'sber' },
                preview: {
                    accentLight: '#108E26',
                    onAccentLight: '#fff',
                    surfaceLight: '#fff',
                    accentDark: '#1A9E32',
                    surfaceDark: '#101010',
                },
            },
        ]);
        const view = at('/projects/project-1/design-systems/ds-1/themes/theme-1/settings', <ThemeSettingsPage />);
        expect(await screen.findByText('Параметры темы')).toBeInTheDocument();
        expect(view.container.querySelector('.ps-main > .ps-header + .ps-content')).toBeInTheDocument();
        expect(view.container.querySelector('.project-settings > .ps-nav')).toBeInTheDocument();
        expect(view.container.querySelector('.project-settings > .ps-aside')).toBeInTheDocument();
        expect(workflowCss).toMatch(
            /@media\s*\(max-width:\s*760px\)\s*\{[\s\S]*?\.project-settings\s*\{[^}]*grid-template-columns:\s*1fr/,
        );
        expect(workflowCss).toMatch(/\.ps-nav\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*row/);
        expect(workflowCss).toMatch(/\.ps-aside\s*\{[^}]*display:\s*none/);
    });

    it.each([
        ['Design System', <CreateDesignSystemPage />, 'create'],
        ['Theme', <CreateThemePage />, 'createTenant'],
    ] as const)('does not expose the %s create form before project access is loaded', (label, page, mutation) => {
        vi.spyOn(projectsApi, 'get').mockImplementation(() => new Promise(() => {}));
        const request = vi.spyOn(designSystemsApi, mutation);
        const path =
            label === 'Theme'
                ? '/projects/project-1/design-systems/ds-1/themes/new'
                : '/projects/project-1/design-systems/new';

        at(path, page);

        expect(screen.getByText('Загружаем проект…')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Создать/ })).not.toBeInTheDocument();
        expect(request).not.toHaveBeenCalled();
    });

    it('keeps the current project in Create Design System navigation', async () => {
        vi.spyOn(projectsApi, 'get').mockResolvedValue(project('owner'));
        vi.spyOn(designSystemsApi, 'list').mockResolvedValue([
            { id: 'ds-1', projectId: 'project-1', name: 'System', tenantCount: 0, themePreviews: [] },
        ]);
        at('/projects/project-1/design-systems/new', <CreateDesignSystemPage />);
        expect(await screen.findByPlaceholderText('Название дизайн-системы')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Создать дизайн-систему' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Отмена' })).toHaveAttribute('href', '/projects/project-1');
        expect(screen.getByTestId('design-systems-catalog-cards')).toHaveTextContent('System');
        expect(screen.getByRole('button', { name: 'Создать' })).toBeDisabled();
    });

    it('opens a newly created design system without a full-page skeleton flash', async () => {
        vi.spyOn(projectsApi, 'get').mockResolvedValue(project('owner'));
        vi.spyOn(projectsApi, 'list').mockResolvedValue([project('owner')]);
        vi.spyOn(designSystemsApi, 'list').mockResolvedValue([]);
        vi.spyOn(designSystemsApi, 'create').mockResolvedValue({
            id: 'ds-new',
            projectId: 'project-1',
            name: 'New System',
            tenantCount: 0,
            themePreviews: [],
        });
        vi.spyOn(designSystemsApi, 'get').mockImplementation(() => new Promise(() => {}));
        vi.spyOn(designSystemsApi, 'tenants').mockImplementation(() => new Promise(() => {}));
        const view = render(
            <MemoryRouter initialEntries={['/projects/project-1/design-systems/new']}>
                <Routes>
                    <Route path="/projects/:projectId/design-systems/new" element={<CreateDesignSystemPage />} />
                    <Route path="/projects/:projectId/design-systems/:designSystemId" element={<DesignSystemPage />} />
                </Routes>
            </MemoryRouter>,
        );
        fireEvent.change(await screen.findByPlaceholderText('Название дизайн-системы'), {
            target: { value: 'New System' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Создать' }));
        expect(await screen.findByText('Тем пока нет')).toBeInTheDocument();
        expect(view.container.querySelector('.catalog-loading-grid')).not.toBeInTheDocument();
        expect(screen.getByText('DS Builder').parentElement).toHaveTextContent(
            'DS Builder/Проекты/Platform/New System',
        );
    });

    it('renders the current project in the project catalog breadcrumb', async () => {
        vi.spyOn(projectsApi, 'get').mockResolvedValue(project('owner'));
        vi.spyOn(designSystemsApi, 'list').mockResolvedValue([]);
        at('/projects/project-1', <ProjectPage />);

        await screen.findByText('Дизайн-систем пока нет');
        expect(screen.getByText('DS Builder').parentElement).toHaveTextContent('DS Builder/Проекты/Platform');
    });

    it('disables the empty-name Theme create action', async () => {
        vi.spyOn(projectsApi, 'get').mockResolvedValue(project('editor'));
        at('/projects/project-1/design-systems/ds-1/themes/new', <CreateThemePage />);

        expect(await screen.findByRole('button', { name: 'Создать и открыть Theme' })).toBeDisabled();
    });

    it.each([
        ['Design System', <CreateDesignSystemPage />, 'create'],
        ['Theme', <CreateThemePage />, 'createTenant'],
    ] as const)('does not expose the %s create form when project access fails', async (label, page, mutation) => {
        vi.spyOn(projectsApi, 'get').mockRejectedValue(new ApiError(403));
        const request = vi.spyOn(designSystemsApi, mutation);
        const path =
            label === 'Theme'
                ? '/projects/project-1/design-systems/ds-1/themes/new'
                : '/projects/project-1/design-systems/new';

        at(path, page);

        expect(await screen.findByText('Нет доступа')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Создать/ })).not.toBeInTheDocument();
        expect(request).not.toHaveBeenCalled();
    });

    it('renders dynamic and legacy fallback theme covers', async () => {
        vi.spyOn(projectsApi, 'get').mockResolvedValue(project('viewer'));
        vi.spyOn(designSystemsApi, 'get').mockResolvedValue({
            id: 'ds-1',
            projectId: 'project-1',
            name: 'DS',
            tenantCount: 2,
            themePreviews: [],
        });
        vi.spyOn(designSystemsApi, 'tenants').mockResolvedValue([
            {
                id: 'theme-1',
                designSystemId: 'ds-1',
                name: 'Dynamic',
                editRevision: 0,
                colorConfig: { profile: 'sber' },
                preview: {
                    accentLight: '#108E26',
                    onAccentLight: '#FFFFFF',
                    surfaceLight: '#FFFFFF',
                    accentDark: '#1A9E32',
                    surfaceDark: '#101010',
                },
            },
            {
                id: 'theme-2',
                designSystemId: 'ds-1',
                name: 'Legacy',
                editRevision: 0,
                colorConfig: {},
                preview: {
                    accentLight: '#2563EB',
                    onAccentLight: '#FFFFFF',
                    surfaceLight: '#F6F8FC',
                    accentDark: '#60A5FA',
                    surfaceDark: '#111827',
                },
            },
        ]);
        at('/projects/project-1/design-systems/ds-1', <DesignSystemPage />);
        expect(await screen.findByText('Dynamic')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Legacy' })).toBeInTheDocument();
        expect(screen.queryByText('Удалить')).not.toBeInTheDocument();
    });

    it('keeps Theme form data and shows the exact duplicate-name error', async () => {
        vi.spyOn(projectsApi, 'get').mockResolvedValue(project('editor'));
        vi.spyOn(designSystemsApi, 'createTenant').mockRejectedValue(new ApiError(409, 'TENANT_NAME_CONFLICT'));
        at('/projects/project-1/design-systems/ds-1/themes/new', <CreateThemePage />);
        const name = await screen.findByLabelText('Название');
        fireEvent.change(name, { target: { value: '  Brand   Theme  ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Создать и открыть Theme' }));
        expect(await screen.findByText('Theme с таким названием уже существует.')).toBeInTheDocument();
        expect(name).toHaveValue('  Brand   Theme  ');
    });

    it('validates all four Custom HEX fields before sending', async () => {
        vi.spyOn(projectsApi, 'get').mockResolvedValue(project('editor'));
        const create = vi.spyOn(designSystemsApi, 'createTenant');
        at('/projects/project-1/design-systems/ds-1/themes/new', <CreateThemePage />);
        fireEvent.change(await screen.findByLabelText('Название'), { target: { value: 'Custom theme' } });
        fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
        fireEvent.change(screen.getByLabelText('Primary'), { target: { value: '#xyz' } });
        fireEvent.click(screen.getByRole('button', { name: 'Создать и открыть Theme' }));
        expect(await screen.findByText('Введите цвета в формате #RRGGBB.')).toBeInTheDocument();
        expect(create).not.toHaveBeenCalled();
    });

    it('removes transfer UI and fully deletes a design system only after exact-name confirmation', async () => {
        vi.spyOn(projectsApi, 'get').mockResolvedValue(project('owner'));
        vi.spyOn(projectsApi, 'list').mockResolvedValue([
            project('owner'),
            { ...project('maintainer'), id: 'project-2', name: 'Target' },
        ]);
        vi.spyOn(designSystemsApi, 'get').mockResolvedValue({
            id: 'ds-1',
            projectId: 'project-1',
            name: 'DS',
            tenantCount: undefined as unknown as number,
            themePreviews: [],
        });
        vi.spyOn(designSystemsApi, 'tenants').mockResolvedValue([
            {
                id: 'theme-1',
                designSystemId: 'ds-1',
                name: 'One',
                editRevision: 0,
                colorConfig: { profile: 'sber' },
                preview: {
                    accentLight: '#108E26',
                    onAccentLight: '#fff',
                    surfaceLight: '#fff',
                    accentDark: '#1A9E32',
                    surfaceDark: '#101010',
                },
            },
        ]);
        const remove = vi.spyOn(designSystemsApi, 'remove').mockResolvedValue();
        at('/projects/project-1/design-systems/ds-1/settings', <DesignSystemSettingsPage />);
        expect(await screen.findByRole('navigation', { name: 'Разделы: Настройки дизайн-системы' })).toHaveTextContent(
            'ОсновноеУдаление',
        );
        expect(screen.getByText('Публикация в npm')).toBeInTheDocument();
        expect(screen.getByText('Не опубликовано')).toBeInTheDocument();
        expect(screen.queryByText('Перенос')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Удаление' }));
        expect(screen.queryByRole('link', { name: 'Готово' })).not.toBeInTheDocument();
        expect(screen.getByText('Опасная зона')).toHaveClass('ps-danger-title');
        expect(screen.getByText('1 тема')).toBeInTheDocument();
        const confirmation = screen.getAllByRole('textbox').at(-1)!;
        fireEvent.change(confirmation, { target: { value: 'DS' } });
        fireEvent.click(screen.getByRole('button', { name: 'Удалить полностью' }));
        await waitFor(() => expect(remove).toHaveBeenCalledWith('project-1', 'ds-1'));
    });

    it('uses the exact design-system preview structure and icon-only settings action', async () => {
        vi.spyOn(projectsApi, 'get').mockResolvedValue(project('owner'));
        vi.spyOn(designSystemsApi, 'list').mockResolvedValue([
            {
                id: 'ds-1',
                projectId: 'project-1',
                name: 'System',
                tenantCount: 1,
                themePreviews: [
                    {
                        tenantId: 'theme-1',
                        name: 'Brand',
                        preview: {
                            accentLight: '#108E26',
                            onAccentLight: '#fff',
                            surfaceLight: '#fff',
                            accentDark: '#1A9E32',
                            surfaceDark: '#101010',
                        },
                    },
                ],
            },
        ]);
        const view = at('/projects/project-1', <ProjectPage />);
        expect(await screen.findByTestId('design-system-preview')).toHaveClass('catalog-tiles', 'is-design-system');
        expect(view.container.querySelectorAll('[data-testid="design-system-preview"] > .catalog-tile')).toHaveLength(
            1,
        );
        expect(screen.getByTestId('design-system-preview')).toHaveAttribute('data-count', '1');
        expect(screen.getByTestId('design-system-preview')).toHaveTextContent('BrandТема');
        expect(screen.getByText('1 тема')).toBeInTheDocument();
        const settings = screen.getByRole('link', { name: 'Настройки проекта' });
        expect(settings).toHaveAttribute('title', 'Настройки проекта');
        expect(settings).not.toHaveTextContent('Настройки');
    });

    it('opens accessible project and design-system card context menus', async () => {
        vi.spyOn(projectsApi, 'list').mockResolvedValue([project('owner')]);
        const projects = at('/projects', <ProjectsPage />);
        await screen.findByText('Platform');
        const projectMenu = screen.getByRole('button', { name: 'Действия: Platform' });
        expect(projectMenu).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(projectMenu);
        expect(screen.getByRole('menu')).toHaveTextContent('НастройкиПереименоватьАрхивировать');
        expect(projects.container.querySelector('.card-kebab')).toBeInTheDocument();
        cleanup();

        vi.spyOn(projectsApi, 'get').mockResolvedValue(project('owner'));
        vi.spyOn(designSystemsApi, 'list').mockResolvedValue([
            { id: 'ds-1', projectId: 'project-1', name: 'System', tenantCount: 0, themePreviews: [] },
        ]);
        at('/projects/project-1', <ProjectPage />);
        fireEvent.click(await screen.findByRole('button', { name: 'Действия: System' }));
        expect(screen.getByRole('menu')).toHaveTextContent('НастройкиПереименоватьУдалить');
    });

    it('shows real Theme names without a display-name heuristic and keeps the context menu', async () => {
        vi.spyOn(projectsApi, 'get').mockResolvedValue(project('owner'));
        vi.spyOn(designSystemsApi, 'tenants').mockResolvedValue([
            {
                id: 'base',
                designSystemId: 'ds-1',
                name: 'base_default',
                editRevision: 0,
                colorConfig: {},
                preview: {
                    accentLight: '#108e26',
                    onAccentLight: '#fff',
                    surfaceLight: '#fff',
                    accentDark: '#1a9e32',
                    surfaceDark: '#101010',
                },
            },
            {
                id: 'theme-1',
                designSystemId: 'ds-1',
                name: 'Brand Theme',
                editRevision: 0,
                colorConfig: { profile: 'sber' },
                preview: {
                    accentLight: '#108e26',
                    onAccentLight: '#fff',
                    surfaceLight: '#fff',
                    accentDark: '#1a9e32',
                    surfaceDark: '#101010',
                },
            },
        ]);
        at('/projects/project-1/design-systems/ds-1', <DesignSystemPage />);
        expect(await screen.findByRole('heading', { name: 'Brand Theme' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'base_default' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Действия: Brand Theme' }));
        expect(screen.getByRole('menu')).toHaveTextContent('НастройкиПереименоватьУдалить');
    });

    it('hides a technical design system by stable API identity, regardless of its display name', async () => {
        vi.spyOn(projectsApi, 'get').mockResolvedValue(project('owner'));
        vi.spyOn(designSystemsApi, 'list').mockResolvedValue([
            {
                id: 'technical-ds',
                projectId: null,
                isTechnical: true,
                name: 'Renamed shared system',
                tenantCount: 1,
                themePreviews: [],
            },
            {
                id: 'project-ds',
                projectId: 'project-1',
                isTechnical: false,
                name: 'Project system',
                tenantCount: 0,
                themePreviews: [],
            },
        ]);
        at('/projects/project-1', <ProjectPage />);
        expect(await screen.findByRole('heading', { name: 'Project system' })).toBeInTheDocument();
        expect(screen.queryByText('Renamed shared system')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Действия: Renamed shared system' })).not.toBeInTheDocument();
    });

    it('excludes technical design-system themes from project settings aggregates', async () => {
        vi.spyOn(projectsApi, 'get').mockResolvedValue(project('owner'));
        vi.spyOn(projectsApi, 'members').mockResolvedValue([]);
        vi.spyOn(designSystemsApi, 'list').mockResolvedValue([
            {
                id: 'technical-ds',
                projectId: null,
                isTechnical: true,
                name: 'Shared internals',
                tenantCount: 9,
                themePreviews: [],
            },
            {
                id: 'project-ds',
                projectId: 'project-1',
                isTechnical: false,
                name: 'Project system',
                tenantCount: 2,
                themePreviews: [],
            },
        ]);
        at('/projects/project-1/settings', <ProjectSettingsPage />);
        fireEvent.click(await screen.findByRole('button', { name: 'Администрирование' }));
        expect(screen.getByText('1 дизайн-систем')).toBeInTheDocument();
        expect(screen.getByText('2 тем')).toBeInTheDocument();
        expect(screen.queryByText('11 тем')).not.toBeInTheDocument();
    });

    it('shows only the profile action in the rail and closes it with Escape', async () => {
        vi.spyOn(projectsApi, 'list').mockResolvedValue([]);
        vi.spyOn(authService, 'getCurrentUser').mockReturnValue({
            id: 'user-1',
            username: 'alex',
            email: 'alex@example.com',
            displayName: 'Alex User',
            initials: 'AU',
        });
        const logout = vi.spyOn(authService, 'logout').mockResolvedValue();
        at('/projects', <ProjectsPage />);
        await screen.findByText('Проектов пока нет');
        expect(screen.queryByRole('button', { name: 'Уведомления' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Помощь и тур' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Профиль' }));
        expect(screen.getByRole('button', { name: 'Профиль' })).toHaveTextContent('AU');
        expect(screen.getByRole('menu', { name: 'Меню профиля' })).toHaveTextContent(
            'Alex Useralex · alex@example.comВыйти',
        );
        expect(screen.getAllByRole('menuitem')).toHaveLength(1);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('menu', { name: 'Меню профиля' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Профиль' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Выйти' }));
        await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    });
});
