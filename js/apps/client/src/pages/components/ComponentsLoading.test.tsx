import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    fetchWebPreviewPluginDescriptor: vi.fn(),
    problems: vi.fn(),
    coreReleaseId: undefined as string | undefined,
    coreRevision: undefined as number | undefined,
    reportRevision: undefined as number | undefined,
    config: {
        getName: () => 'Button',
        getComponentId: () => 'web-Button',
        getPlatform: () => 'web' as const,
        getCoreReleaseId: () => mocks.coreReleaseId,
        getMeta: () => ({}),
        getConfigurationId: () => undefined,
        getCoreSelectionRevision: () => mocks.coreRevision,
        getConfigurations: () => [],
    },
}));

vi.mock('../../layouts', () => ({
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
    componentRepository: {
        saveComponentMutation: vi.fn(),
        loadComponentCatalog: vi.fn(async () => []),
        loadComponentTemplates: vi.fn(async () => []),
    },
}));

vi.mock('../../api/http', () => ({
    http: {
        get: async (url: string, options: unknown) => {
            if (url.endsWith('/compatibility'))
                return {
                    data: {
                        context: {
                            coreSelectionRevision: mocks.reportRevision,
                            coreReleases: [{ releaseId: mocks.coreReleaseId, platform: 'web' }],
                        },
                        items: [],
                        blockingCount: 0,
                        warningCount: 0,
                    },
                };
            const data = await mocks.fetchWebPreviewPluginDescriptor(url, options);
            if (!data) throw { isAxiosError: true, response: { status: 404 } };
            return { data };
        },
    },
}));

import { Components } from './Components';

const editorContext = { projectId: 'project', designSystemId: 'ds', tenantId: 'tenant' };

const renderPage = (
    state: {
        componentLoading?: boolean;
        componentError?: string;
        components?: unknown[];
        composeComponents?: unknown[];
    },
    reload = vi.fn(),
    route = '/components/Button',
) => {
    const context = {
        designSystem: {
            getParameters: () => editorContext,
            getComponentDataByName: () => ({}),
            getComponentData: () => ({}),
            findComponentData: (platform: string, name: string) => ({
                serverBinding: { componentId: `${platform}-${name}` },
            }),
        },
        theme: {},
        components: [mocks.config],
        updated: {},
        rerender: vi.fn(),
        reload,
        ...state,
    };
    render(
        <MemoryRouter initialEntries={[route]}>
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
    mocks.coreReleaseId = undefined;
    mocks.coreRevision = undefined;
    mocks.reportRevision = undefined;
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

        expect(screen.getByRole('complementary', { name: 'Компоненты дизайн-системы' })).toBeInTheDocument();
        expect(screen.getByRole('status', { name: 'Загружаем компонент…' })).toBeInTheDocument();
        expect(document.querySelector('.component-editor-skeleton .tw-skeleton')).not.toBeNull();
        expect(screen.queryByText('настройка и превью')).not.toBeInTheDocument();
    });

    it('показывает ошибку компонента с повтором, меню остаётся', () => {
        const reload = renderPage({ componentError: 'сбой' });

        expect(screen.getByRole('complementary', { name: 'Компоненты дизайн-системы' })).toBeInTheDocument();
        const error = screen.getByRole('alert', { name: 'Не удалось загрузить компонент' });
        expect(error).toHaveTextContent('Не удалось загрузить данные');
        expect(error).toHaveTextContent('Проверьте подключение и попробуйте ещё раз.');
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

    it('без прямого адреса берёт адрес web-плагина у бэкенда для выбранной ДС при входе', async () => {
        mocks.fetchWebPreviewPluginDescriptor.mockResolvedValue({
            buildId: '0123456789ab',
            pluginUrl: 'http://localhost:9000/web-preview/builds/0123456789ab/',
        });
        renderPage({ componentLoading: true });

        expect(await screen.findByTestId('web-preview-host')).toBeInTheDocument();
        expect(mocks.fetchWebPreviewPluginDescriptor).toHaveBeenCalledTimes(1);
        expect(mocks.fetchWebPreviewPluginDescriptor).toHaveBeenCalledWith(
            '/api/projects/project/design-systems/ds/preview/web',
            expect.anything(),
        );

        cleanup();
        renderPage({ componentLoading: true });
        expect(await screen.findByTestId('web-preview-host')).toBeInTheDocument();
        expect(mocks.fetchWebPreviewPluginDescriptor).toHaveBeenCalledTimes(2);
    });

    it('reloads an older model on the first report even if the Core release did not change', async () => {
        mocks.coreReleaseId = 'same-core';
        mocks.coreRevision = 1;
        mocks.reportRevision = 2;
        mocks.fetchWebPreviewPluginDescriptor.mockResolvedValue({
            buildId: 'same-build',
            pluginUrl: 'https://preview.test/same/',
            coreRelease: { releaseId: 'same-core' },
        });
        const reload = renderPage({});
        await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce());
        fireEvent.focus(window);
        await vi.waitFor(() => expect(mocks.fetchWebPreviewPluginDescriptor).toHaveBeenCalledTimes(2));
        expect(reload).toHaveBeenCalledOnce();
    });

    it('не передаёт модель A в preview B и запрашивает новую модель', async () => {
        mocks.coreReleaseId = 'core-A';
        mocks.fetchWebPreviewPluginDescriptor.mockResolvedValue({
            buildId: 'build-B',
            pluginUrl: 'https://preview.test/B/',
            coreRelease: { releaseId: 'core-B' },
        });
        const reload = renderPage({});
        await vi.waitFor(() => expect(mocks.fetchWebPreviewPluginDescriptor).toHaveBeenCalled());
        await vi.waitFor(() => expect(reload).toHaveBeenCalled());
        expect(screen.queryByTestId('web-preview-host')).not.toBeInTheDocument();
    });

    it('не создаёт хост web-плагина, если web-плагин не опубликован', async () => {
        renderPage({ componentLoading: true });

        await vi.waitFor(() => expect(mocks.fetchWebPreviewPluginDescriptor).toHaveBeenCalledTimes(1));
        expect(screen.queryByTestId('web-preview-host')).not.toBeInTheDocument();
        expect(screen.getByRole('complementary', { name: 'Компоненты дизайн-системы' })).toBeInTheDocument();
    });

    it('не спрашивает адрес web-плагина, если в разделе нет web-компонентов', async () => {
        renderPage({ componentLoading: true, components: [] });

        await Promise.resolve();
        expect(mocks.fetchWebPreviewPluginDescriptor).not.toHaveBeenCalled();
        expect(screen.queryByTestId('web-preview-host')).not.toBeInTheDocument();
    });
});
