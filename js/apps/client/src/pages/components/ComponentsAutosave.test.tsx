import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    currentMeta: { enabled: true } as Record<string, unknown>,
    config: {
        getName: () => 'Button',
        getMeta: () => structuredClone(mocks.currentMeta),
    },
    inputMeta: { enabled: true, kind: 'input' } as Record<string, unknown>,
    inputConfig: {
        getName: () => 'Input',
        getMeta: () => structuredClone(mocks.inputMeta),
    },
    saveComponentMutation: vi.fn(async () => ({ style: 1 })),
}));

vi.mock('../../utils', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../utils')>()),
    getOldMenuItems: () => ({
        groups: [
            {
                data: [
                    {
                        items: [
                            { name: 'Button', disabled: false, data: [mocks.config] },
                            { name: 'Input', disabled: false, data: [mocks.inputConfig] },
                        ],
                    },
                ],
            },
        ],
    }),
}));

vi.mock('../../layouts', () => ({
    MenuOld: () => null,
    Workspace: ({ content }: { content: ReactNode }) => <>{content}</>,
}));

vi.mock('./features/ComponentEditor', () => ({
    ComponentEditor: ({ onConfigUpdate }: { onConfigUpdate: () => void }) => (
        <button type="button" onClick={onConfigUpdate}>
            изменить
        </button>
    ),
}));

vi.mock('../../api/componentRepository', () => ({
    componentRepository: { saveComponentMutation: mocks.saveComponentMutation },
}));

import { Components } from './Components';
import { waitForDraftAutosaveIdle } from '../../api/draftAutosaveActivity';

describe('Components autosave', () => {
    beforeEach(() => {
        localStorage.clear();
        mocks.currentMeta = { enabled: true };
        mocks.inputMeta = { enabled: true, kind: 'input' };
        mocks.saveComponentMutation.mockClear();
        mocks.saveComponentMutation.mockResolvedValue({ style: 1 });
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('сохраняет исходную базу частично выполненной операции после открытия редактора', async () => {
        const before = { enabled: true, localStyle: 'old' };
        localStorage.setItem(
            'ds_pending_component:project:ds:tenant:Button:request',
            JSON.stringify({
                componentName: 'Button',
                before,
                after: { enabled: false, localStyle: 'local-id' },
                idempotencyKeys: { 'style:local-id': 'original-key' },
                prepared: true,
                generation: 'recovered',
                retryCount: 0,
            }),
        );
        mocks.currentMeta = { enabled: false, localStyle: 'server-id' };
        const context = {
            designSystem: {
                getParameters: () => ({ projectId: 'project', designSystemId: 'ds', tenantId: 'tenant' }),
                getComponentDataByName: () => ({}),
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
        await waitFor(() => expect(mocks.saveComponentMutation).toHaveBeenCalledOnce());
        expect(mocks.saveComponentMutation.mock.calls[0][2].before).toEqual(before);
    });

    it('отправляет изменение даже при переполненном localStorage', async () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('quota', 'QuotaExceededError');
        });
        const context = {
            designSystem: {
                getParameters: () => ({ projectId: 'project', designSystemId: 'ds', tenantId: 'tenant' }),
                getComponentDataByName: () => ({}),
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

        mocks.currentMeta = { enabled: false };
        fireEvent.click(await screen.findByRole('button', { name: 'изменить' }));

        await waitFor(() => expect(mocks.saveComponentMutation).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.getByRole('status', { name: /Последнее сохранение/ })).toBeInTheDocument());
    });

    it('восстанавливает создание до следующей правки удаления с новой базой', async () => {
        const key = 'ds_pending_component:project:ds:tenant:Button:request';
        const predecessor = {
            componentName: 'Button',
            before: { enabled: true },
            after: { enabled: false, value: 1 },
            prepared: true,
            idempotencyKeys: { property: 'original-key' },
            requestBodies: {},
            generation: 'first',
            tokenKey: 'Button',
            operationKey: 'Button',
            retryCount: 0,
            metadataKey: key,
        };
        localStorage.setItem(
            key,
            JSON.stringify({
                ...predecessor,
                generation: 'second',
                prepared: false,
                idempotencyKeys: {},
                after: { enabled: true },
                predecessor,
            }),
        );
        const context = {
            designSystem: {
                getParameters: () => ({ projectId: 'project', designSystemId: 'ds', tenantId: 'tenant' }),
                getComponentDataByName: () => ({}),
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
        await waitFor(() => expect(mocks.saveComponentMutation).toHaveBeenCalledTimes(2));
        expect(mocks.saveComponentMutation.mock.calls[0][2]).toEqual(
            expect.objectContaining({
                generation: 'first',
                before: { enabled: true },
                idempotencyKeys: { property: 'original-key' },
            }),
        );
        expect(mocks.saveComponentMutation.mock.calls[1][2]).toEqual(
            expect.objectContaining({
                generation: 'second',
                before: predecessor.after,
                after: { enabled: true },
                idempotencyKeys: {},
            }),
        );
        await waitFor(() => expect(localStorage.getItem(key)).toBeNull());
    });

    it('ignores and removes corrupted revision metadata', async () => {
        localStorage.setItem('ds_pending_component:project:ds:tenant:Button:revisions', '{broken');
        const context = {
            designSystem: {
                getParameters: () => ({ projectId: 'project', designSystemId: 'ds', tenantId: 'tenant' }),
                getComponentDataByName: () => ({}),
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

        mocks.currentMeta = { enabled: false };
        fireEvent.click(await screen.findByRole('button', { name: 'изменить' }));

        await waitFor(() => expect(mocks.saveComponentMutation).toHaveBeenCalledTimes(1));
        expect(mocks.saveComponentMutation.mock.calls[0][3]).toEqual({});
    });

    it('отправляет ожидающее изменение при уходе до окончания задержки', async () => {
        const context = {
            designSystem: {
                getParameters: () => ({ projectId: 'project', designSystemId: 'ds', tenantId: 'tenant' }),
                getComponentDataByName: () => ({}),
            },
            theme: {},
            components: [mocks.config],
            updated: {},
            rerender: vi.fn(),
            reload: vi.fn(),
        };
        const Parent = () => <Outlet context={context} />;
        const view = render(
            <MemoryRouter initialEntries={['/components/Button']}>
                <Routes>
                    <Route element={<Parent />}>
                        <Route path="components/:componentName" element={<Components />} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );

        fireEvent.click(await screen.findByRole('button', { name: 'изменить' }));
        view.unmount();

        await waitFor(() => expect(mocks.saveComponentMutation).toHaveBeenCalledTimes(1));
        await waitFor(() =>
            expect(localStorage.getItem('ds_pending_component:project:ds:tenant:Button:request')).toBeNull(),
        );
    });

    it('не разрешает публикацию, пока сохранение компонента после ухода со страницы не завершилось', async () => {
        let finishSave: ((value: Record<string, number>) => void) | undefined;
        const pendingSave = new Promise<Record<string, number>>((resolve) => {
            finishSave = resolve;
        });
        mocks.saveComponentMutation.mockReturnValueOnce(pendingSave);
        const editorContext = { projectId: 'project', designSystemId: 'ds', tenantId: 'tenant' };
        const context = {
            designSystem: {
                getParameters: () => editorContext,
                getComponentDataByName: () => ({}),
            },
            theme: {},
            components: [mocks.config],
            updated: {},
            rerender: vi.fn(),
            reload: vi.fn(),
        };
        const Parent = () => <Outlet context={context} />;
        const view = render(
            <MemoryRouter initialEntries={['/components/Button']}>
                <Routes>
                    <Route element={<Parent />}>
                        <Route path="components/:componentName" element={<Components />} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );

        mocks.currentMeta = { enabled: false };
        fireEvent.click(await screen.findByRole('button', { name: 'изменить' }));
        view.unmount();
        await waitFor(() => expect(mocks.saveComponentMutation).toHaveBeenCalledTimes(1));
        let released = false;
        const publicationBarrier = waitForDraftAutosaveIdle(editorContext, 1_000).then(() => {
            released = true;
        });
        await Promise.resolve();
        expect(released).toBe(false);

        finishSave?.({ style: 1 });
        await publicationBarrier;
        expect(released).toBe(true);
    });

    it('serializes newer edits and does not let an old response remove the latest request', async () => {
        let finishFirst: ((value: Record<string, number>) => void) | undefined;
        const firstSave = new Promise<Record<string, number>>((resolve) => {
            finishFirst = resolve;
        });
        mocks.saveComponentMutation.mockReturnValueOnce(firstSave);
        const context = {
            designSystem: {
                getParameters: () => ({ projectId: 'project', designSystemId: 'ds', tenantId: 'tenant' }),
                getComponentDataByName: () => ({}),
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
        mocks.currentMeta = { enabled: false, value: 1 };
        fireEvent.click(edit);
        await waitFor(() => expect(mocks.saveComponentMutation).toHaveBeenCalledTimes(1));
        mocks.saveComponentMutation.mock.calls[0][2].idempotencyKeys.property = 'first-create-key';
        mocks.saveComponentMutation.mock.calls[0][2].styleAliases = { 'local-style': 'server-style' };
        mocks.saveComponentMutation.mock.calls[0][4]?.({ style: 1 });
        mocks.currentMeta = { enabled: true };
        fireEvent.click(edit);
        expect(mocks.saveComponentMutation).toHaveBeenCalledTimes(1);
        const firstProgress = mocks.saveComponentMutation.mock.calls[0][4] as
            | ((revisions: Record<string, number>) => void)
            | undefined;
        firstProgress?.({ style: 1 });
        const recovered = JSON.parse(localStorage.getItem('ds_pending_component:project:ds:tenant:Button:request')!);
        expect(recovered.after).toEqual({ enabled: true });
        expect(recovered.predecessor.idempotencyKeys).toEqual({ property: 'first-create-key' });

        finishFirst?.({ style: 1 });
        await firstSave;
        await waitFor(() => expect(mocks.saveComponentMutation).toHaveBeenCalledTimes(2));
        expect(mocks.saveComponentMutation.mock.calls[1][2]).toEqual(
            expect.objectContaining({
                before: { enabled: false, value: 1 },
                after: { enabled: true },
                idempotencyKeys: {},
                styleAliases: { 'local-style': 'server-style' },
            }),
        );
        await waitFor(() =>
            expect(localStorage.getItem('ds_pending_component:project:ds:tenant:Button:request')).toBeNull(),
        );
        expect(
            JSON.parse(localStorage.getItem('ds_pending_component:project:ds:tenant:Button:style-aliases')!),
        ).toEqual({ 'local-style': 'server-style' });
    });

    it('does not use a late confirmation from the previous component as the new component baseline', async () => {
        let finishButton: ((value: Record<string, number>) => void) | undefined;
        const buttonSave = new Promise<Record<string, number>>((resolve) => {
            finishButton = resolve;
        });
        mocks.saveComponentMutation.mockReturnValueOnce(buttonSave).mockResolvedValueOnce({ style: 2 });
        const context = {
            designSystem: {
                getParameters: () => ({ projectId: 'project', designSystemId: 'ds', tenantId: 'tenant' }),
                getComponentDataByName: () => ({}),
            },
            theme: {},
            components: [mocks.config, mocks.inputConfig],
            updated: {},
            rerender: vi.fn(),
            reload: vi.fn(),
        };
        const Parent = () => {
            const navigate = useNavigate();
            return (
                <>
                    <button type="button" onClick={() => navigate('/components/Input')}>
                        к Input
                    </button>
                    <Outlet context={context} />
                </>
            );
        };
        render(
            <MemoryRouter initialEntries={['/components/Button']}>
                <Routes>
                    <Route element={<Parent />}>
                        <Route path="components/:componentName" element={<Components />} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );

        mocks.currentMeta = { enabled: false, value: 'button-change' };
        fireEvent.click(await screen.findByRole('button', { name: 'изменить' }));
        await waitFor(() => expect(mocks.saveComponentMutation).toHaveBeenCalledTimes(1));
        fireEvent.click(screen.getByRole('button', { name: 'к Input' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'изменить' })).toBeInTheDocument());
        finishButton?.({ style: 1 });
        await buttonSave;

        mocks.inputMeta = { enabled: false, kind: 'input', value: 'input-change' };
        fireEvent.click(screen.getByRole('button', { name: 'изменить' }));
        await waitFor(() => expect(mocks.saveComponentMutation).toHaveBeenCalledTimes(2));

        expect(mocks.saveComponentMutation.mock.calls[1][2]).toEqual(
            expect.objectContaining({
                componentName: 'Input',
                before: { enabled: true, kind: 'input' },
                after: { enabled: false, kind: 'input', value: 'input-change' },
            }),
        );
    });
});
