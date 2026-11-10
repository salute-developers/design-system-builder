import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createMemoryRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom';

vi.mock('../api', () => ({ authService: { isAuthenticated: () => true } }));
vi.mock('./metrica', () => ({ webAnalytics: { view: vi.fn() } }));
import { AnalyticsNavigation } from './AnalyticsNavigation';
import { webAnalytics } from './metrica';

const colors = '/projects/secret/design-systems/private/themes/tenant/colors';
const typography = colors.replace('colors', 'typography');
const settle = async () => {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
    });
};
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

it('tracks stable initial route, transitions and back/forward with basename, excluding redirect/query/hash', async () => {
    const router = createMemoryRouter(
        [
            {
                path: '/',
                element: (
                    <>
                        <AnalyticsNavigation />
                        <Outlet />
                    </>
                ),
                children: [
                    { path: 'redirect', element: <Navigate to={colors} replace /> },
                    { path: '*', element: <div>screen</div> },
                ],
            },
        ],
        { basename: '/base', initialEntries: ['/base/redirect'] },
    );
    const view = render(<RouterProvider router={router} />);
    await settle();
    expect(webAnalytics.view).toHaveBeenCalledTimes(1);
    expect(vi.mocked(webAnalytics.view).mock.calls[0][0].path).toBe(
        '/projects/:projectId/design-systems/:designSystemId/themes/:tenantId/colors',
    );
    view.rerender(<RouterProvider router={router} />);
    await act(async () => {
        await router.navigate(`${colors}?filter=secret#section`);
    });
    await settle();
    expect(webAnalytics.view).toHaveBeenCalledTimes(1);
    await act(async () => {
        await router.navigate(typography);
    });
    await settle();
    await act(async () => {
        await router.navigate(-1);
    });
    await settle();
    await act(async () => {
        await router.navigate(1);
    });
    await settle();
    expect(vi.mocked(webAnalytics.view).mock.calls.map(([view]) => view.path.split('/').at(-1))).toEqual([
        'colors',
        'typography',
        'colors',
        'typography',
    ]);
    router.dispose();
});

it('tracks normalized screen immediately regardless of OAuth-like query or hash', async () => {
    const router = createMemoryRouter([{ path: '*', element: <AnalyticsNavigation /> }], {
        initialEntries: [`${colors}?code=private&state=secret#access_token=hidden`],
    });
    render(<RouterProvider router={router} />);
    await settle();
    expect(webAnalytics.view).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(webAnalytics.view).mock.calls)).not.toMatch(/private|secret|hidden|code=|access_token/);
    await act(async () => {
        await router.navigate(colors, { replace: true });
    });
    await settle();
    expect(webAnalytics.view).toHaveBeenCalledTimes(1);
    router.dispose();
});

it('records the final screen again when a redirect returns to the previously visited pathname', async () => {
    const router = createMemoryRouter(
        [
            {
                path: '/',
                element: (
                    <>
                        <AnalyticsNavigation />
                        <Outlet />
                    </>
                ),
                children: [
                    { path: 'redirect', element: <Navigate to={colors} replace /> },
                    { path: '*', element: <div>screen</div> },
                ],
            },
        ],
        { initialEntries: [colors] },
    );
    render(<RouterProvider router={router} />);
    await settle();
    await act(async () => {
        await router.navigate('/redirect');
    });
    await settle();
    expect(webAnalytics.view).toHaveBeenCalledTimes(2);
    router.dispose();
});
