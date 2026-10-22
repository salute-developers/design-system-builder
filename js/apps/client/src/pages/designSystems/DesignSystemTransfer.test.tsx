import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApiError, designSystemsApi, projectsApi, type ProjectDto, type ProjectRole } from '../../api';
import { tokenRepository } from '../../api/tokenRepository';
import { designSystemsApi as designSystemsData } from '../../modules/designSystems/data/designSystemsApi';
import { can } from '../../modules/projects/domain/permissions';
import { themesApi } from '../../modules/themes/data/themesApi';
import { resetQueryCache } from '../../shared/data/useLoad';
import { ProjectPage } from '../projects/ProjectOverview';
import { CreateDesignSystemPage } from './CreateDesignSystemPage';
import { DesignSystemSettingsPage } from './DesignSystemSettingsPage';

const project = (role: ProjectRole, status: ProjectDto['status'] = 'active'): ProjectDto => ({
    id: 'project-1',
    name: 'Platform',
    status,
    ownerUserId: 'owner-1',
    effectiveRole: role,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
});

const themeFile = {
    meta: {
        name: 'brand',
        version: '1.0.0',
        tokens: [{ type: 'color', name: 'light.text.primary', displayName: 'Primary', tags: ['text'], enabled: true }],
        color: { mode: [] },
    },
    variations: { color: { web: { 'light.text.primary': '#FFFFFF' } } },
};

const renderAt = (path: string) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/projects/:projectId" element={<ProjectPage />} />
                <Route path="/projects/:projectId/design-systems/new" element={<CreateDesignSystemPage />} />
                <Route path="/projects/:projectId/design-systems/:designSystemId" element={<p>Обзор системы</p>} />
                <Route
                    path="/projects/:projectId/design-systems/:designSystemId/settings"
                    element={<DesignSystemSettingsPage />}
                />
            </Routes>
        </MemoryRouter>,
    );

const upload = async (content: string, name = 'brand.json') =>
    fireEvent.change(await screen.findByLabelText('Файл темы'), {
        target: { files: [new File([content], name, { type: 'application/json' })] },
    });

// Разбор файла грузит генератор токенов динамическим импортом: первый вызов дольше секунды.
const PARSE_TIMEOUT = { timeout: 10_000 };

beforeEach(() => {
    vi.restoreAllMocks();
    resetQueryCache();
    vi.spyOn(designSystemsApi, 'list').mockResolvedValue([]);
});

afterEach(cleanup);

describe('design system import and export', () => {
    it('grants import and export only to the project owner', () => {
        const roles: ProjectRole[] = ['viewer', 'editor', 'maintainer', 'owner'];
        expect(roles.filter((role) => can(role, 'designSystems:import'))).toEqual(['owner']);
        expect(roles.filter((role) => can(role, 'designSystems:export'))).toEqual(['owner']);
    });

    it.each([
        ['owner', 'active', true],
        ['maintainer', 'active', false],
        ['owner', 'archived', false],
    ] as const)('shows the catalog import action to %s of an %s project: %s', async (role, status, visible) => {
        vi.spyOn(projectsApi, 'get').mockResolvedValue(project(role, status));
        renderAt('/projects/project-1');
        await waitFor(() => expect(screen.queryByText('Загружаем проект…')).not.toBeInTheDocument());
        await screen.findByRole('link', { name: 'Настройки проекта' });
        const link = screen.queryByRole('link', { name: 'Импортировать' });
        if (visible) expect(link).toHaveAttribute('href', '/projects/project-1/design-systems/new?mode=import');
        else expect(link).not.toBeInTheDocument();
    });

    it('imports a theme file with one batch of values and opens the design system', { timeout: 20_000 }, async () => {
        vi.spyOn(projectsApi, 'get').mockResolvedValue(project('owner'));
        const create = vi.spyOn(designSystemsData, 'create').mockResolvedValue({
            id: 'ds-new',
            projectId: 'project-1',
            name: 'brand',
            tenantCount: 0,
            themePreviews: [],
        });
        const createTenant = vi.spyOn(themesApi, 'create').mockResolvedValue({
            id: 't-1',
            designSystemId: 'ds-new',
            name: 'brand_default',
            editRevision: 3,
        } as never);
        vi.spyOn(designSystemsData, 'tokens').mockResolvedValue([{ id: 'tok-1', name: 'text.primary', type: 'color' }]);
        const save = vi.spyOn(themesApi, 'saveTokenValues').mockResolvedValue({ editRevision: 4 });
        renderAt('/projects/project-1/design-systems/new?mode=import');

        expect(await screen.findByRole('link', { name: 'Отмена' })).toHaveAttribute('href', '/projects/project-1');
        // Кнопка каталога остаётся видимой за открытым окном импорта.
        expect(screen.getByRole('link', { name: 'Импортировать' })).toHaveAttribute(
            'href',
            '/projects/project-1/design-systems/new?mode=import',
        );
        await upload(JSON.stringify(themeFile));
        await waitFor(
            () => expect(screen.getByPlaceholderText('Название дизайн-системы')).toHaveValue('brand'),
            PARSE_TIMEOUT,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Импортировать' }));

        expect(await screen.findByText('Обзор системы')).toBeInTheDocument();
        expect(create).toHaveBeenCalledWith('project-1', { name: 'brand', projectName: 'Platform' });
        expect(createTenant).toHaveBeenCalledWith('project-1', { designSystemId: 'ds-new', name: 'brand_default' });
        expect(save).toHaveBeenCalledTimes(1);
        expect(save).toHaveBeenCalledWith('project-1', 't-1', {
            editRevision: 3,
            values: [{ tokenId: 'tok-1', platform: 'web', mode: 'light', paletteId: null, value: '#FFFFFF' }],
        });
    });

    it('rolls the design system back when the batch is rejected', { timeout: 20_000 }, async () => {
        vi.spyOn(projectsApi, 'get').mockResolvedValue(project('owner'));
        const create = vi.spyOn(designSystemsData, 'create').mockResolvedValue({
            id: 'ds-new',
            projectId: 'project-1',
            name: 'brand',
            tenantCount: 0,
            themePreviews: [],
        });
        vi.spyOn(themesApi, 'create').mockResolvedValue({ id: 't-1', editRevision: 0 } as never);
        vi.spyOn(designSystemsData, 'tokens').mockResolvedValue([{ id: 'tok-1', name: 'text.primary', type: 'color' }]);
        vi.spyOn(themesApi, 'saveTokenValues').mockRejectedValue(new ApiError(400, 'INVALID_TOKEN_VALUE'));
        const remove = vi.spyOn(designSystemsData, 'remove').mockResolvedValue();
        renderAt('/projects/project-1/design-systems/new?mode=import');

        await upload('{not json');
        expect(await screen.findByRole('alert', {}, PARSE_TIMEOUT)).toHaveTextContent('Не удалось прочитать файл');
        expect(create).not.toHaveBeenCalled();

        await upload(JSON.stringify(themeFile));
        await waitFor(
            () => expect(screen.getByPlaceholderText('Название дизайн-системы')).toHaveValue('brand'),
            PARSE_TIMEOUT,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Импортировать' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Файл темы не прошёл проверку');
        expect(remove).toHaveBeenCalledWith('project-1', 'ds-new');
    });
    it('keeps maintainers on the plain create form even with the import mode in the address', async () => {
        vi.spyOn(projectsApi, 'get').mockResolvedValue(project('maintainer'));
        renderAt('/projects/project-1/design-systems/new?mode=import');
        await screen.findByPlaceholderText('Название дизайн-системы');
        expect(screen.getByRole('heading', { name: 'Создать дизайн-систему' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Импортировать из файла' })).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Файл темы')).not.toBeInTheDocument();
    });

    it.each([
        ['owner', true],
        ['maintainer', false],
    ] as const)('offers export in the design system card menu to %s: %s', async (role, visible) => {
        vi.spyOn(projectsApi, 'get').mockResolvedValue(project(role));
        vi.spyOn(designSystemsApi, 'list').mockResolvedValue([
            { id: 'ds-1', projectId: 'project-1', name: 'brand', tenantCount: 2, themePreviews: [] },
        ]);
        vi.spyOn(themesApi, 'list').mockResolvedValue([
            { id: 'theme-1', designSystemId: 'ds-1', name: 'other', editRevision: 0, colorConfig: {} },
            { id: 'theme-2', designSystemId: 'ds-1', name: 'brand_default', editRevision: 0, colorConfig: {} },
        ] as never);
        const exported = vi
            .spyOn(tokenRepository, 'loadTokenData')
            .mockResolvedValue({ themeData: themeFile } as never);
        const createObjectURL = vi.fn(() => 'blob:theme');
        Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
        renderAt('/projects/project-1');

        fireEvent.click(await screen.findByRole('button', { name: 'Действия: brand' }));
        const item = screen.queryByRole('menuitem', { name: 'Экспортировать' });
        if (!visible) {
            expect(item).not.toBeInTheDocument();
            return;
        }
        fireEvent.click(item!);
        await waitFor(() =>
            expect(exported).toHaveBeenCalledWith({
                projectId: 'project-1',
                designSystemId: 'ds-1',
                tenantId: 'theme-2',
            }),
        );
        await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
        await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    });
});
