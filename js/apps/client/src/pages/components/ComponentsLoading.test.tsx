import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    fetchWebPreviewPluginDescriptor: vi.fn(),
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

vi.mock('../../api/webPreviewPluginRepository', () => ({
    fetchWebPreviewPluginDescriptor: mocks.fetchWebPreviewPluginDescriptor,
}));

import { resetWebPreviewPluginLocation } from '../../composePreview';
import { Components } from './Components';

const editorContext = { projectId: 'project', designSystemId: 'ds', tenantId: 'tenant' };

const renderPage = (
    state: { componentLoading?: boolean; componentError?: string; components?: unknown[] },
    reload = vi.fn(),
) => {
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

beforeEach(() => {
    resetWebPreviewPluginLocation();
    vi.stubEnv('VITE_WEB_PREVIEW_PLUGIN_URL', '');
    mocks.fetchWebPreviewPluginDescriptor.mockResolvedValue(undefined);
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
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

    it('прогревает web-плагин при входе в раздел, если у ДС есть web-компоненты', () => {
        vi.stubEnv('VITE_WEB_PREVIEW_PLUGIN_URL', 'http://localhost:3011/');
        renderPage({ componentLoading: true });

        // Компонент ещё грузится, области превью нет, а хост web-плагина уже смонтирован.
        expect(screen.queryByText('настройка и превью')).not.toBeInTheDocument();
        expect(screen.getByTestId('web-preview-host')).toBeInTheDocument();
        // Прямой адрес из сборки: бэкенд не спрашивается.
        expect(mocks.fetchWebPreviewPluginDescriptor).not.toHaveBeenCalled();
    });

    it('без прямого адреса берёт адрес web-плагина у бэкенда один раз на проект', async () => {
        mocks.fetchWebPreviewPluginDescriptor.mockResolvedValue({
            buildId: '0123456789ab',
            pluginUrl: 'http://localhost:9000/web-preview/builds/0123456789ab/',
        });
        renderPage({ componentLoading: true });

        expect(await screen.findByTestId('web-preview-host')).toBeInTheDocument();
        expect(mocks.fetchWebPreviewPluginDescriptor).toHaveBeenCalledTimes(1);
        expect(mocks.fetchWebPreviewPluginDescriptor).toHaveBeenCalledWith('project');

        cleanup();
        renderPage({ componentLoading: true });
        expect(await screen.findByTestId('web-preview-host')).toBeInTheDocument();
        expect(mocks.fetchWebPreviewPluginDescriptor).toHaveBeenCalledTimes(1);
    });

    it('не создаёт хост web-плагина, если web-плагин не опубликован', async () => {
        renderPage({ componentLoading: true });

        await vi.waitFor(() => expect(mocks.fetchWebPreviewPluginDescriptor).toHaveBeenCalledTimes(1));
        expect(screen.queryByTestId('web-preview-host')).not.toBeInTheDocument();
        expect(screen.getByRole('navigation', { name: 'Компоненты' })).toBeInTheDocument();
    });

    it('не спрашивает адрес web-плагина, если в разделе нет web-компонентов', async () => {
        renderPage({ componentLoading: true, components: [] });

        await Promise.resolve();
        expect(mocks.fetchWebPreviewPluginDescriptor).not.toHaveBeenCalled();
        expect(screen.queryByTestId('web-preview-host')).not.toBeInTheDocument();
    });
});
