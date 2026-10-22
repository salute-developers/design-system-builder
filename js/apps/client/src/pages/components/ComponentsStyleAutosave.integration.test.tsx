import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    currentMeta: {
        defaultVariations: [],
        invariantProps: [],
        variations: [
            { id: 'variation', styles: [] as Array<{ id: string; name: string; intersections: null; props: [] }> },
        ],
    },
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    remove: vi.fn(),
    config: {
        getName: () => 'Button',
        getPlatform: () => 'web' as const,
        getMeta: () => structuredClone(mocks.currentMeta),
    },
}));
vi.mock('../../api/http', () => ({
    http: { get: mocks.get, post: mocks.post, patch: mocks.patch, delete: mocks.remove },
}));
vi.mock('../../api/editorReads', () => ({
    readEditor: (url: string) => mocks.get(url),
    invalidateEditorReads: vi.fn(),
}));
vi.mock('../../utils', async (original) => ({
    ...(await original<typeof import('../../utils')>()),
    getOldMenuItems: () => ({ groups: [{ data: [{ items: [{ name: 'Button', data: [mocks.config] }] }] }] }),
}));
vi.mock('../../layouts', () => ({
    MenuOld: () => null,
    Workspace: ({ content }: { content: ReactNode }) => <>{content}</>,
}));
vi.mock('./features/ComponentEditor', () => ({
    ComponentEditor: ({ onConfigUpdate }: { onConfigUpdate: () => void }) => (
        <button onClick={onConfigUpdate}>изменить</button>
    ),
}));

import { Components } from './Components';

afterEach(cleanup);

it('deletes the server style when the user removes its local style during creation', async () => {
    localStorage.clear();
    let links: Array<{ id: string; appearanceVariationId: string; styleId: string; position: number }> = [];
    let finishStyle: ((response: { data: { id: string }; headers: object }) => void) | undefined;
    mocks.get.mockImplementation(async (url: string) => {
        if (url.endsWith('/appearance-variations'))
            return { data: [{ id: 'axis', appearanceId: 'appearance', variationId: 'variation' }] };
        if (url.endsWith('/appearance-variation-values')) return { data: [...links] };
        return { data: [] };
    });
    mocks.post.mockImplementation(async (url: string, body: Record<string, unknown>) => {
        if (url.endsWith('/styles'))
            return new Promise((resolve) => {
                finishStyle = resolve;
            });
        if (url.endsWith('/appearance-variation-values')) {
            const link = { id: 'link', ...body } as (typeof links)[number];
            links.push(link);
            return { data: link, headers: {} };
        }
        throw new Error(`Unexpected POST ${url}`);
    });
    mocks.remove.mockResolvedValue({ data: {}, headers: {} });
    const context = {
        designSystem: {
            getParameters: () => ({ projectId: 'project', designSystemId: 'ds', tenantId: 'tenant' }),
            getComponentDataByName: () => ({ serverBinding: { componentId: 'component', appearanceId: 'appearance' } }),
        },
        theme: {},
        components: [mocks.config],
        updated: {},
        rerender: vi.fn(),
        reload: vi.fn(),
    };
    const Parent = () => <Outlet context={context} />;
    render(
        <MemoryRouter initialEntries={['/components/Button']}>
            <Routes>
                <Route element={<Parent />}>
                    <Route path="components/:componentName" element={<Components />} />
                </Route>
            </Routes>
        </MemoryRouter>,
    );
    const edit = await screen.findByRole('button', { name: 'изменить' });
    mocks.currentMeta.variations[0].styles = [{ id: 'local-style', name: 'm', intersections: null, props: [] }];
    fireEvent.click(edit);
    await waitFor(() => expect(finishStyle).toBeDefined());
    mocks.currentMeta.variations[0].styles = [];
    fireEvent.click(edit);
    finishStyle!({ data: { id: 'server-style' }, headers: {} });
    await waitFor(() =>
        expect(mocks.remove).toHaveBeenCalledWith(expect.stringMatching('/styles/server-style$'), expect.anything()),
    );
    expect(mocks.remove).toHaveBeenCalledWith(
        expect.stringMatching('/appearance-variation-values/link$'),
        expect.anything(),
    );
    expect(mocks.remove.mock.calls.some(([url]) => String(url).endsWith('/local-style'))).toBe(false);
    await waitFor(() =>
        expect(localStorage.getItem('ds_pending_component:project:ds:tenant:Button:request')).toBeNull(),
    );
    expect(JSON.parse(localStorage.getItem('ds_pending_component:project:ds:tenant:Button:style-aliases')!)).toEqual({
        'local-style': 'server-style',
    });
});
