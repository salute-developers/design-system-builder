import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    config: {
        getName: () => 'Button',
        getPlatform: () => 'web' as const,
        getMeta: () => ({}),
    },
}));

vi.mock('../../utils', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../utils')>()),
    getOldMenuItems: () => ({
        groups: [{ data: [{ items: [{ name: 'Button', disabled: false, data: [mocks.config] }] }] }],
    }),
}));

vi.mock('../../layouts', () => ({
    MenuOld: () => <nav aria-label="Компоненты">меню</nav>,
    Workspace: ({ menu, content }: { menu: ReactNode; content: ReactNode }) => (
        <>
            {menu}
            {content}
        </>
    ),
}));

vi.mock('./features/ComponentEditor', () => ({
    ComponentEditor: () => <div>настройка и превью</div>,
}));

vi.mock('../../api/componentRepository', () => ({
    componentRepository: { saveComponentMutation: vi.fn() },
}));

import { Components } from './Components';

const editorContext = { projectId: 'project', designSystemId: 'ds', tenantId: 'tenant' };

const renderPage = (state: { componentLoading?: boolean; componentError?: string }, reload = vi.fn()) => {
    const context = {
        designSystem: { getParameters: () => editorContext, getComponentDataByName: () => ({}) },
        theme: {},
        components: [mocks.config],
        updated: {},
        rerender: vi.fn(),
        reload,
        ...state,
    };
    render(
        <MemoryRouter initialEntries={['/components/Button']}>
            <Routes>
                <Route element={<Outlet context={context} />}>
                    <Route path="components/:componentName" element={<Components />} />
                </Route>
            </Routes>
        </MemoryRouter>,
    );
    return reload;
};

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('Components: загрузка выбранного компонента', () => {
    it('показывает загрузку только вместо настройки и превью, меню остаётся', () => {
        renderPage({ componentLoading: true });

        expect(screen.getByRole('navigation', { name: 'Компоненты' })).toBeInTheDocument();
        expect(screen.getByText('Загружаем компонент…').closest('[role="status"]')).not.toBeNull();
        expect(screen.queryByText('настройка и превью')).not.toBeInTheDocument();
    });

    it('показывает ошибку компонента с повтором, меню остаётся', () => {
        const reload = renderPage({ componentError: 'сбой' });

        expect(screen.getByRole('navigation', { name: 'Компоненты' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
        expect(reload).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('настройка и превью')).not.toBeInTheDocument();
    });

    it('без загрузки и ошибки показывает настройку и превью', () => {
        renderPage({});

        expect(screen.getByText('настройка и превью')).toBeInTheDocument();
    });
});
