import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const { hookState, reload } = vi.hoisted(() => ({ hookState: { loading: false }, reload: vi.fn() }));
vi.mock('../hooks', () => ({
    useForceRerender: () => [null, vi.fn()],
    useDesignSystem: () => ({
        designSystem: hookState.loading
            ? null
            : {
                  getName: () => 'System',
                  getParameters: () => ({
                      projectName: 'Platform',
                      packagesName: 'System',
                      accentColor: 'blue',
                      darkFillSaturation: 500,
                      readOnly: false,
                  }),
              },
        theme: hookState.loading ? null : { getName: () => 'Brand' },
        components: hookState.loading ? null : [],
        incompleteTokenIds: [],
        loadError: null,
        reload,
    }),
}));

import { Main } from './Main';

afterEach(() => {
    hookState.loading = false;
    cleanup();
});

describe('Theme editor shell', () => {
    it('uses breadcrumbs for hierarchy, opens Theme settings, and omits the obsolete overview action', () => {
        const view = render(
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

        const breadcrumbs = screen.getByRole('navigation', { name: 'Навигация темы' });
        expect(screen.getByTestId('editor-rail')).toHaveClass('builder-icon-sidebar');
        expect(breadcrumbs.closest('header')).toHaveClass('builder-hierarchy-bar');
        expect(breadcrumbs).toHaveTextContent('DS Builder/Проекты/Platform/System/Brand');
        expect(breadcrumbs.querySelector('a[href="/projects/project-1"]')).toHaveTextContent('Platform');
        expect(breadcrumbs.querySelector('a[href="/projects/project-1/design-systems/ds-1"]')).toHaveTextContent(
            'System',
        );
        expect(screen.getByRole('link', { name: 'Настройки темы' })).toHaveAttribute(
            'href',
            '/projects/project-1/design-systems/ds-1/themes/theme-1/settings',
        );
        expect(screen.getByRole('link', { name: 'Настройки темы' })).toHaveClass('builder-icon-button');
        expect(screen.getByTestId('editor-nav-colors')).toBeInTheDocument();
        expect(view.container.querySelector('[data-testid="editor-nav-overview"]')).not.toBeInTheDocument();
        expect(screen.getByText('Цветовые токены')).toBeInTheDocument();
    });

    it('shows a circular progress indicator in the shared toolbar while the Theme loads', () => {
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

        const spinner = screen.getByRole('status', { name: 'Загрузка темы' });
        expect(spinner.closest('header')).toHaveClass('builder-hierarchy-bar');
        expect(screen.queryByRole('navigation', { name: 'Навигация темы' })).not.toBeInTheDocument();
        expect(screen.queryByText(/Загружаем Theme/)).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Настройки темы' })).not.toBeInTheDocument();
    });
});
