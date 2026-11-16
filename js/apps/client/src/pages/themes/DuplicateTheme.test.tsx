import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { ApiError, designSystemsApi, projectsApi, type ProjectDto } from '../../api';
import { themesApi } from '../../modules/themes/data/themesApi';
import type { ThemeTenant } from '../../modules/themes/domain/theme';
import { resetQueryCache } from '../../shared/data/useLoad';
import { CreateThemePage } from './CreateThemePage';
import { ThemeCard } from './ThemeCard';

const theme = (
    id: string,
    name: string,
    profile: ThemeTenant['colorConfig']['profile'] = 'malachite',
): ThemeTenant => ({
    id,
    designSystemId: 'ds-1',
    name,
    editRevision: 0,
    colorConfig: { profile },
    preview: {
        accentLight: '#107F8C',
        onAccentLight: '#FFFFFF',
        surfaceLight: '#FFFFFF',
        accentDark: '#19B9A5',
        surfaceDark: '#111111',
    },
});

const project = (role: ProjectDto['effectiveRole']): ProjectDto => ({
    id: 'project-1',
    name: 'Platform',
    status: 'active',
    ownerUserId: 'owner-1',
    effectiveRole: role,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
});

const Location = () => {
    const location = useLocation();
    return <output data-testid="location">{location.pathname}</output>;
};

const renderAt = (path: string, element: React.ReactNode) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/projects/:projectId/design-systems/:designSystemId/themes/new" element={element} />
                <Route path="/projects/:projectId/design-systems/:designSystemId" element={element} />
                <Route path="*" element={<Location />} />
            </Routes>
        </MemoryRouter>,
    );

beforeEach(() => {
    vi.restoreAllMocks();
    resetQueryCache();
    vi.spyOn(projectsApi, 'get').mockResolvedValue(project('editor'));
    vi.spyOn(designSystemsApi, 'get').mockResolvedValue({
        id: 'ds-1',
        projectId: 'project-1',
        name: 'System',
        tenantCount: 2,
        themePreviews: [],
    });
});
afterEach(cleanup);

describe('дублирование темы', () => {
    it('меню карточки открывает окно копии и после создания открывает копию', async () => {
        const duplicate = vi.spyOn(themesApi, 'duplicate').mockResolvedValue(theme('copy-1', 'Malachite копия'));
        renderAt(
            '/projects/project-1/design-systems/ds-1',
            <ThemeCard projectId="project-1" theme={theme('theme-1', 'Malachite')} role="editor" />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Действия: Malachite' }));
        expect(screen.getByRole('menu')).toHaveTextContent('ПереименоватьДублировать');
        fireEvent.click(screen.getByRole('menuitem', { name: 'Дублировать' }));
        const dialog = screen.getByRole('dialog', { name: 'Дублировать тему Malachite' });
        const name = within(dialog).getByLabelText('Название копии');
        expect(name).toHaveValue('Malachite копия');
        fireEvent.change(name, { target: { value: '  Malachite   Promo ' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Дублировать' }));

        await waitFor(() => expect(duplicate).toHaveBeenCalledWith('project-1', 'ds-1', 'theme-1', 'Malachite Promo'));
        expect(await screen.findByTestId('location')).toHaveTextContent(
            '/projects/project-1/design-systems/ds-1/themes/copy-1/overview',
        );
    });

    it('окно показывает конфликт названия и остаётся открытым', async () => {
        vi.spyOn(themesApi, 'duplicate').mockRejectedValue(new ApiError(409, 'TENANT_NAME_CONFLICT'));
        renderAt(
            '/projects/project-1/design-systems/ds-1',
            <ThemeCard projectId="project-1" theme={theme('theme-1', 'Malachite')} role="editor" />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Действия: Malachite' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Дублировать' }));
        fireEvent.click(screen.getByRole('button', { name: 'Дублировать' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Theme с таким названием уже существует.');
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('окно не отправляет название длиннее 80 символов', async () => {
        const duplicate = vi.spyOn(themesApi, 'duplicate');
        renderAt(
            '/projects/project-1/design-systems/ds-1',
            <ThemeCard projectId="project-1" theme={theme('theme-1', 'M'.repeat(76))} role="editor" />,
        );
        fireEvent.click(screen.getByRole('button', { name: /Действия:/ }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Дублировать' }));
        fireEvent.click(screen.getByRole('button', { name: 'Дублировать' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Название Theme должно быть не длиннее 80 символов.');
        expect(duplicate).not.toHaveBeenCalled();
    });

    it('форма создания при ошибке загрузки тем не уходит молча в профиль', async () => {
        const list = vi
            .spyOn(themesApi, 'list')
            .mockRejectedValueOnce(new Error('network'))
            .mockResolvedValue([theme('theme-1', 'Malachite')]);
        const view = renderAt('/projects/project-1/design-systems/ds-1/themes/new', <CreateThemePage />);

        expect(await screen.findByText(/Не удалось загрузить темы дизайн-системы/)).toBeInTheDocument();
        fireEvent.change(screen.getByPlaceholderText('Например, Light Theme'), { target: { value: 'New' } });
        expect(view.container.querySelector('.create-theme-footer button')).toBeDisabled();

        fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
        expect(await screen.findByRole('group', { name: 'Способ создания' })).toBeInTheDocument();
        expect(list).toHaveBeenCalledTimes(2);
    });

    it('форма создания при существующих темах предлагает копию с исходной темой из адреса', async () => {
        vi.spyOn(themesApi, 'list').mockResolvedValue([
            theme('theme-1', 'Malachite'),
            theme('theme-2', 'Sber', 'sber'),
        ]);
        const duplicate = vi.spyOn(themesApi, 'duplicate').mockResolvedValue(theme('copy-1', 'Sber Promo'));
        const create = vi.spyOn(designSystemsApi, 'createTenant');
        renderAt('/projects/project-1/design-systems/ds-1/themes/new?from=theme-2', <CreateThemePage />);

        const method = await screen.findByRole('group', { name: 'Способ создания' });
        expect(within(method).getByRole('button', { name: 'Копия темы' })).toHaveAttribute('aria-pressed', 'true');
        const sources = screen.getByRole('radiogroup', { name: 'Исходная тема' });
        expect(within(sources).getByRole('radio', { name: /Sber/ })).toHaveAttribute('aria-checked', 'true');
        expect(screen.queryByText('Стартовая палитра')).not.toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText('Например, Light Theme'), { target: { value: 'Sber Promo' } });
        fireEvent.click(screen.getByRole('button', { name: 'Создать копию и открыть' }));

        await waitFor(() => expect(duplicate).toHaveBeenCalledWith('project-1', 'ds-1', 'theme-2', 'Sber Promo'));
        expect(create).not.toHaveBeenCalled();
    });

    it('способ «Из профиля» возвращает прежнюю форму профилей', async () => {
        vi.spyOn(themesApi, 'list').mockResolvedValue([theme('theme-1', 'Malachite')]);
        renderAt('/projects/project-1/design-systems/ds-1/themes/new', <CreateThemePage />);

        fireEvent.click(await screen.findByRole('button', { name: 'Из профиля' }));
        expect(screen.getByText('Стартовая палитра')).toBeInTheDocument();
        expect(screen.queryByRole('radiogroup', { name: 'Исходная тема' })).not.toBeInTheDocument();
    });

    it('в дизайн-системе без тем форма открывается сразу с профилями', async () => {
        vi.spyOn(themesApi, 'list').mockResolvedValue([]);
        renderAt('/projects/project-1/design-systems/ds-1/themes/new', <CreateThemePage />);

        expect(await screen.findByText('Стартовая палитра')).toBeInTheDocument();
        expect(screen.queryByRole('group', { name: 'Способ создания' })).not.toBeInTheDocument();
    });
});
