import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DesignSystemPage } from './DesignSystemOverview';
import { readEditor } from '../../api/editorReads';
import { clearDsReadBoundaries } from '../../api/dsReadBoundary';
import { resetQueryCache } from '../../shared/data/useLoad';

const mocks = vi.hoisted(() => ({ get: vi.fn(), authenticated: vi.fn(() => false) }));
vi.mock('../../api/http', () => ({ http: { get: mocks.get } }));
vi.mock('../../api/authService', () => ({
    authService: {
        isAuthenticated: mocks.authenticated,
        getCurrentUser: () => null,
        onSessionReset: () => () => undefined,
    },
}));

const versionId = '550e8400-e29b-41d4-a716-446655440001';
const root = '/api/projects/project/design-systems/system';
const headers = {
    'cache-control': 'no-store',
    'x-ds-read-context': JSON.stringify({
        designSystemId: 'system',
        version: '1.0.0',
        versionId,
        accessMode: 'public',
    }),
};
beforeEach(() => {
    vi.clearAllMocks();
    clearDsReadBoundaries();
    resetQueryCache();
    window.history.replaceState({}, '', '/projects/project/design-systems/system');
});
afterEach(() => {
    cleanup();
    clearDsReadBoundaries();
    resetQueryCache();
});
const open = () =>
    render(
        <MemoryRouter initialEntries={['/projects/project/design-systems/system']}>
            <Routes>
                <Route path="/projects/:projectId/design-systems/:designSystemId" element={<DesignSystemPage />} />
            </Routes>
        </MemoryRouter>,
    );
it.each([false, true])(
    'reads a public system without project or discovery requests (authenticated=%s)',
    async (authenticated) => {
        mocks.authenticated.mockReturnValue(authenticated);
        mocks.get.mockImplementation(async (url: string) => {
            if (url === root)
                return {
                    headers,
                    data: {
                        id: 'system',
                        name: 'Public system',
                        projectName: 'Project',
                        tenantCount: 1,
                        themePreviews: [],
                    },
                };
            if (url === `${root}/tenants`)
                return {
                    headers,
                    data: [
                        {
                            id: 'theme',
                            designSystemId: 'system',
                            name: 'Published theme',
                            colorConfig: { profile: 'sber' },
                        },
                    ],
                };
            throw new Error(`Unexpected request: ${url}`);
        });
        open();
        expect(await screen.findByRole('link', { name: /Published theme/ })).toHaveAttribute(
            'href',
            `/projects/project/design-systems/system/themes/theme/colors?versionId=${versionId}`,
        );
        expect(mocks.get.mock.calls.map(([url]) => url)).toEqual([root, `${root}/tenants`]);
        expect(mocks.get.mock.calls[1][1].params).toEqual({ versionId });
        expect(screen.queryByText('Создать тему')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Настройки дизайн-системы')).not.toBeInTheDocument();
    },
);
it('offers login after anonymous 404 without claiming the system exists', async () => {
    mocks.authenticated.mockReturnValue(false);
    mocks.get.mockRejectedValue({ isAxiosError: true, response: { status: 404 } });
    open();
    const login = await screen.findByRole('link', { name: 'Войти' });
    expect(login).toHaveAttribute('href', '/login?returnTo=%2Fprojects%2Fproject%2Fdesign-systems%2Fsystem');
    expect(screen.queryByText('Приватная дизайн-система существует')).not.toBeInTheDocument();
    expect(mocks.get.mock.calls.map(([url]) => url)).toEqual([root]);
});

const VersionNavigation = ({ versions }: { versions: string[] }) => {
    const navigate = useNavigate();
    return (
        <nav>
            {versions.map((id, index) => (
                <button
                    key={id}
                    onClick={() => {
                        const target = `/projects/project/design-systems/system?versionId=${id}`;
                        window.history.replaceState({}, '', target);
                        navigate(target);
                    }}
                >
                    Версия {index + 1}
                </button>
            ))}
        </nav>
    );
};

it('resolves A again after A → B → A and pins links and uncached reads to A', async () => {
    mocks.authenticated.mockReturnValue(false);
    const first = versionId;
    const second = '550e8400-e29b-41d4-a716-446655440002';
    const selectedPaths: string[] = [];
    mocks.get.mockImplementation(async (url: string, config?: { params?: { versionId?: string } }) => {
        const selected = config?.params?.versionId ?? first;
        const suffix = selected === first ? 'A' : 'B';
        const selectedHeaders = {
            'cache-control': 'no-store',
            'x-ds-read-context': JSON.stringify({
                designSystemId: 'system',
                versionId: selected,
                version: selected === first ? '1.0.0' : '2.0.0',
                accessMode: 'public',
            }),
        };
        if (url === root) {
            selectedPaths.push(selected);
            return {
                headers: selectedHeaders,
                data: {
                    id: 'system',
                    name: `System ${suffix}`,
                    tenantCount: 1,
                    themePreviews: [],
                },
            };
        }
        if (url === `${root}/tenants`)
            return {
                headers: selectedHeaders,
                data: [
                    {
                        id: `theme-${suffix}`,
                        designSystemId: 'system',
                        name: `Theme ${suffix}`,
                        colorConfig: { profile: 'sber' },
                    },
                ],
            };
        if (url === `${root}/tokens`) return { headers: selectedHeaders, data: [{ name: `Token ${suffix}` }] };
        throw new Error(`Unexpected request: ${url}`);
    });
    const initial = `/projects/project/design-systems/system?versionId=${first}`;
    window.history.replaceState({}, '', initial);
    render(
        <MemoryRouter initialEntries={[initial]}>
            <VersionNavigation versions={[first, second]} />
            <Routes>
                <Route path="/projects/:projectId/design-systems/:designSystemId" element={<DesignSystemPage />} />
            </Routes>
        </MemoryRouter>,
    );
    expect(await screen.findByRole('link', { name: /Theme A/ })).toHaveAttribute(
        'href',
        `/projects/project/design-systems/system/themes/theme-A/colors?versionId=${first}`,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Версия 2' }));
    expect(await screen.findByRole('link', { name: /Theme B/ })).toHaveAttribute(
        'href',
        `/projects/project/design-systems/system/themes/theme-B/colors?versionId=${second}`,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Версия 1' }));
    expect(await screen.findByRole('link', { name: /Theme A/ })).toHaveAttribute(
        'href',
        `/projects/project/design-systems/system/themes/theme-A/colors?versionId=${first}`,
    );
    expect(screen.getByText('System A')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Theme B/ })).not.toBeInTheDocument();
    const tokens = await readEditor<Array<{ name: string }>>(`${root}/tokens`);
    expect(tokens.data).toEqual([{ name: 'Token A' }]);
    expect(mocks.get.mock.calls.at(-1)?.[1].params).toEqual({ versionId: first });
    expect(selectedPaths).toEqual([first, second, first]);
});

it('uses themes from the newly resolved latest publication when returning without a selector', async () => {
    mocks.authenticated.mockReturnValue(false);
    let latest = versionId;
    const second = '550e8400-e29b-41d4-a716-446655440002';
    mocks.get.mockImplementation(async (url: string, config?: { params?: { versionId?: string } }) => {
        const selected = config?.params?.versionId ?? latest;
        const suffix = selected === versionId ? 'A' : 'B';
        const selectedHeaders = {
            'cache-control': 'no-store',
            'x-ds-read-context': JSON.stringify({
                designSystemId: 'system',
                versionId: selected,
                version: selected === versionId ? '1.0.0' : '2.0.0',
                accessMode: 'public',
            }),
        };
        if (url === root)
            return {
                headers: selectedHeaders,
                data: {
                    id: 'system',
                    name: `System ${suffix}`,
                    tenantCount: 1,
                    themePreviews: [],
                },
            };
        if (url === `${root}/tenants`)
            return {
                headers: selectedHeaders,
                data: [
                    {
                        id: `theme-${suffix}`,
                        designSystemId: 'system',
                        name: `Theme ${suffix}`,
                        colorConfig: { profile: 'sber' },
                    },
                ],
            };
        throw new Error(`Unexpected request: ${url}`);
    });
    const firstVisit = open();
    await screen.findByRole('link', { name: /Theme A/ });
    firstVisit.unmount();
    latest = second;
    open();
    expect(await screen.findByRole('link', { name: /Theme B/ })).toHaveAttribute(
        'href',
        `/projects/project/design-systems/system/themes/theme-B/colors?versionId=${second}`,
    );
    expect(screen.queryByRole('link', { name: /Theme A/ })).not.toBeInTheDocument();
});
