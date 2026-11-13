import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    fetchWebPreviewPluginDescriptor: vi.fn(),
    problems: vi.fn(),
    coreReleaseId: undefined as string | undefined,
    config: {
        getName: () => 'Button',
        getComponentId: () => 'web-Button',
        getPlatform: () => 'web' as const,
        getCoreReleaseId: () => mocks.coreReleaseId,
        getMeta: () => ({}),
    },
}));

vi.mock('../../utils', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../utils')>()),
    getComposeMenuItems: () => ({
        groups: [{ data: [{ items: [{ name: 'Button', disabled: false, data: [{ ...mocks.config, getPlatform: () => 'compose', getComponentId: () => 'compose-Button' }] }] }] }],
    }),
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

vi.mock('../../components/CoreProblems', () => ({
    CoreProblems: (props: { componentId: string }) => { mocks.problems(props); return <div>диагностика {props.componentId}</div>; },
}));

vi.mock('../../api/componentRepository', () => ({
    componentRepository: { saveComponentMutation: vi.fn() },
}));

vi.mock('../../api/http', () => ({
    http: { get: async (url: string, options: unknown) => {
        if (url.endsWith('/compatibility')) return { data: {
            context: { coreReleases: [] }, items: [], blockingCount: 0, warningCount: 0,
        } };
        const data = await mocks.fetchWebPreviewPluginDescriptor(url, options);
        if (!data) throw { isAxiosError: true, response: { status: 404 } };
        return { data };
    } },
}));

import { resetWebPreviewPluginLocation } from '../../composePreview';
import { Components } from './Components';

const editorContext = { projectId: 'project', designSystemId: 'ds', tenantId: 'tenant' };

const renderPage = (
    state: { componentLoading?: boolean; componentError?: string; components?: unknown[]; composeComponents?: unknown[] },
    reload = vi.fn(),
    route = '/components/Button',
) => {
    const context = {
        designSystem: { getParameters: () => editorContext, getComponentDataByName: () => ({}),
            findComponentData: (platform: string, name: string) => ({ serverBinding: { componentId: `${platform}-${name}` } }),
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

    it('без прямого адреса берёт адрес web-плагина у бэкенда для выбранной ДС при входе', async () => {
        mocks.fetchWebPreviewPluginDescriptor.mockResolvedValue({
            buildId: '0123456789ab',
            pluginUrl: 'http://localhost:9000/web-preview/builds/0123456789ab/',
        });
        renderPage({ componentLoading: true });

        expect(await screen.findByTestId('web-preview-host')).toBeInTheDocument();
        expect(mocks.fetchWebPreviewPluginDescriptor).toHaveBeenCalledTimes(1);
        expect(mocks.fetchWebPreviewPluginDescriptor).toHaveBeenCalledWith(
            '/api/projects/project/design-systems/ds/preview/web', expect.anything(),
        );

        cleanup();
        renderPage({ componentLoading: true });
        expect(await screen.findByTestId('web-preview-host')).toBeInTheDocument();
        expect(mocks.fetchWebPreviewPluginDescriptor).toHaveBeenCalledTimes(2);
    });

    it('передаёт Compose ID в диагностику вместо одноимённого web-компонента', async () => {
        renderPage({ composeComponents: [mocks.config] }, vi.fn(), '/components/compose-Button?section=problems');
        expect(await screen.findByText('диагностика compose-Button')).toBeInTheDocument();
        expect(mocks.problems).toHaveBeenCalledWith(expect.objectContaining({ componentId: 'compose-Button' }));
        expect(screen.queryByText('диагностика web-Button')).not.toBeInTheDocument();
    });

    it('не передаёт модель A в preview B и запрашивает новую модель', async () => {
        mocks.coreReleaseId = 'core-A';
        mocks.fetchWebPreviewPluginDescriptor.mockResolvedValue({
            buildId: 'build-B', pluginUrl: 'https://preview.test/B/', coreRelease: { releaseId: 'core-B' },
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
        expect(screen.getByRole('navigation', { name: 'Компоненты' })).toBeInTheDocument();
    });

    it('не спрашивает адрес web-плагина, если в разделе нет web-компонентов', async () => {
        renderPage({ componentLoading: true, components: [] });

        await Promise.resolve();
        expect(mocks.fetchWebPreviewPluginDescriptor).not.toHaveBeenCalled();
        expect(screen.queryByTestId('web-preview-host')).not.toBeInTheDocument();
    });
});
