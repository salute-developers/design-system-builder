import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get, put, post, patch, remove } = vi.hoisted(() => ({
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    remove: vi.fn(),
}));
vi.mock('./index', () => ({ http: { get, put, post, patch, delete: remove }, PROJECTS_URL: '/api/projects' }));
vi.mock('./http', () => ({ http: { get, put, post, patch, delete: remove } }));
vi.mock('./editorReads', () => ({
    readEditor: (url: string, request: unknown) => get(url, request),
    invalidateEditorReads: vi.fn(),
    invalidateEditorResources: vi.fn(),
}));

import { componentRepository } from './componentRepository';
import type { PendingComponentMutation } from './editorContracts';

const context = { projectId: 'project-1', designSystemId: 'ds-1', tenantId: 'tenant-1' };
const meta = {
    name: 'Field',
    description: '',
    platform: 'compose',
    serverBinding: { componentId: 'component', appearanceId: 'appearance' },
    sources: { api: [{ id: 'button-style', name: 'buttonStyle', type: 'component_style' }], variations: [], configs: [] },
} as never;
const reference = { targetAppearanceId: 'button-appearance', styleIds: ['size-xxs', 'view-default'] };
const mutation = (
    props: Array<{ id: string; value?: string }>,
    beforeProps: Array<{ id: string; value?: string }> = [],
): PendingComponentMutation => ({
    componentName: 'Field',
    before: { defaultVariations: [], invariantProps: beforeProps as never, variations: [] },
    after: { defaultVariations: [], invariantProps: props as never, variations: [] },
    idempotencyKeys: {},
});

describe('сохранение ссылки на стиль вложенного компонента', () => {
    beforeEach(() => {
        [get, put, post, patch, remove].forEach((mock) => mock.mockReset());
        get.mockResolvedValue({ data: [] });
        put.mockResolvedValue({ data: {}, headers: {} });
    });

    it('пишет выбор операцией оформления с reference, а не значением свойства', async () => {
        await componentRepository.saveComponentMutation(
            context,
            meta,
            mutation([{ id: 'button-style', value: 'basic-button.xxs.default' }]),
            {},
            undefined,
            () => reference,
        );

        expect(put).toHaveBeenCalledWith(
            '/api/projects/project-1/design-systems/ds-1/appearances/appearance/property-values',
            { propertyId: 'button-style', styleIds: [], states: [], reference },
            { headers: { 'Idempotency-Key': expect.any(String) } },
        );
        expect(post).not.toHaveBeenCalled();
        expect(patch).not.toHaveBeenCalled();
    });

    it('передаёт стиль области в styleIds', async () => {
        const scoped = mutation([]);
        scoped.after.variations = [
            { id: 'size', styles: [{ id: 's-m', name: 'm', intersections: null, props: [{ id: 'button-style', value: 'basic-button.xxs' }] }] },
        ] as never;
        scoped.before.variations = [{ id: 'size', styles: [{ id: 's-m', name: 'm', intersections: null, props: [] }] }] as never;

        await componentRepository.saveComponentMutation(context, meta, scoped, {}, undefined, () => reference);

        expect(put.mock.calls[0][1]).toMatchObject({ styleIds: ['s-m'] });
    });

    it('передаёт состояния значения в states', async () => {
        get.mockImplementation(async (url: string) =>
            url.endsWith('/states') ? { data: [{ id: 'hovered-id', name: 'hovered' }] } : { data: [] },
        );
        const withState = mutation([]);
        withState.after.invariantProps = [
            { id: 'button-style', value: 'basic-button.xxs', states: [{ state: ['hovered'], value: 'basic-button.xs' }] },
        ] as never;

        await componentRepository.saveComponentMutation(context, meta, withState, {}, undefined, () => reference);

        expect(put.mock.calls.map((call) => call[1].states)).toContainEqual(['hovered']);
    });

    it.each(['reference_target_not_found', 'reference_invalid_styles', 'reference_too_deep'])(
        'показывает сообщение для кода %s',
        async (code) => {
            put.mockRejectedValue(
                Object.assign(new Error('Request failed'), { isAxiosError: true, response: { status: 422, data: { code } } }),
            );

            await expect(
                componentRepository.saveComponentMutation(
                    context,
                    meta,
                    mutation([{ id: 'button-style', value: 'field.default' }]),
                    {},
                    undefined,
                    () => reference,
                ),
            ).rejects.toThrow(/[А-Яа-я]/);
        },
    );

    it('показывает причину отказа проверки ссылки сообщением', async () => {
        put.mockRejectedValue(
            Object.assign(new Error('Request failed'), {
                isAxiosError: true,
                response: {
                    status: 422,
                    data: { error: 'reference_cycle', message: 'The reference closes a cycle of configurations' },
                },
            }),
        );

        await expect(
            componentRepository.saveComponentMutation(
                context,
                meta,
                mutation([{ id: 'button-style', value: 'field.default' }]),
                {},
                undefined,
                () => reference,
            ),
        ).rejects.toThrow(/цикл/);
    });

    it('не сохраняет ссылку, которую не удалось развернуть', async () => {
        await expect(
            componentRepository.saveComponentMutation(
                context,
                meta,
                mutation([{ id: 'button-style', value: 'missing.xxs' }]),
                {},
                undefined,
                () => undefined,
            ),
        ).rejects.toThrow('COMPONENT_STYLE_REFERENCE_NOT_RESOLVED');
        expect(put).not.toHaveBeenCalled();
    });

    it('очистка идёт обычным удалением значения', async () => {
        get.mockImplementation(async (url: string) => {
            if (url.includes('/invariant-property-values/by-component/'))
                return { data: [{ id: 'value-1', appearanceId: 'appearance', propertyId: 'button-style', stateSetId: 'empty', value: 'a.b' }] };
            if (url.endsWith('/state-sets')) return { data: [{ id: 'empty', stateIds: [] }] };
            return { data: [] };
        });
        remove.mockResolvedValue({ data: {}, headers: {} });

        await componentRepository.saveComponentMutation(
            context,
            meta,
            mutation([], [{ id: 'button-style', value: 'a.b' }]),
            {},
            undefined,
            () => reference,
        );

        expect(remove).toHaveBeenCalledWith(
            '/api/projects/project-1/design-systems/ds-1/invariant-property-values/value-1',
            expect.anything(),
        );
    });
});
