import { beforeEach, describe, expect, it, vi } from 'vitest';

const http = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), delete: vi.fn() }));
const readEditor = vi.hoisted(() => vi.fn());
vi.mock('./http', () => ({ http }));
vi.mock('./editorReads', () => ({ readEditor, invalidateEditorReads: vi.fn(), invalidateEditorResources: vi.fn() }));
vi.mock('./editorHttp', () => ({
    apiRoot: (projectId: string) => `/api/projects/${projectId}`,
    tokenDefinitionsUrl: (context: { projectId: string; designSystemId: string }) =>
        `/api/projects/${context.projectId}/design-systems/${context.designSystemId}/tokens`,
}));

import { componentStructureRepository as repository } from './componentStructureRepository';

const context = { projectId: 'p', designSystemId: 'ds', tenantId: 't', coreSelectionRevision: 5 };
const url = '/api/projects/p/appearances/a/property-values';

describe('componentStructureRepository: пересечения', () => {
    beforeEach(() => {
        Object.values(http).forEach((mock) => mock.mockReset());
        readEditor.mockReset();
        readEditor.mockResolvedValue({ data: [{ id: 'token-1', name: 'text.default.primary' }] });
    });

    it('пишет токен пересечения его ID, а литерал — значением', async () => {
        await repository.setCombinationValue(
            context,
            'a',
            ['s-l', 's-pilled'],
            'color',
            '[light.text.default.primary]',
        );
        await repository.setCombinationValue(context, 'a', ['s-l', 's-pilled'], 'height', '44');
        await repository.setCombinationValue(context, 'a', ['s-l', 's-pilled'], 'background', '#FF000080');

        // Справочник читается только для ссылки на токен и с кешем; литералы пишутся без него.
        expect(readEditor).toHaveBeenCalledTimes(1);
        expect(readEditor).toHaveBeenCalledWith(expect.stringMatching(/\/tokens$/), {}, undefined, 300_000);

        expect(http.put.mock.calls[0][2].headers['X-DS-Core-Selection-Revision']).toBe('5');
        expect(http.put).toHaveBeenNthCalledWith(
            1,
            url,
            { propertyId: 'color', styleIds: ['s-l', 's-pilled'], tokenId: 'token-1', value: null, adjustment: null },
            expect.anything(),
        );
        expect(http.put).toHaveBeenNthCalledWith(
            2,
            url,
            { propertyId: 'height', styleIds: ['s-l', 's-pilled'], tokenId: null, value: '44', adjustment: null },
            expect.anything(),
        );
    });

    it('адресует состояние независимо от базового значения', async () => {
        await repository.setCombinationValue(context, 'a', ['s-l', 's-pilled'], 'height', '55', undefined, ['pressed']);
        expect(http.put).toHaveBeenCalledWith(
            url,
            expect.objectContaining({ states: ['pressed'], value: '55' }),
            expect.anything(),
        );
        await repository.removeCombinationValue(context, 'a', ['s-l', 's-pilled'], 'height', ['pressed']);
        expect(http.delete).toHaveBeenCalledWith(url, {
            headers: { 'X-DS-Core-Selection-Revision': '5' },
            params: { propertyId: 'height', styleIds: 's-l,s-pilled', states: 'pressed' },
        });
    });

    it('сохраняет прозрачность состояния в запросе', async () => {
        await repository.setCombinationValue(
            context,
            'a',
            ['s-l', 's-pilled'],
            'color',
            '#ff0000',
            undefined,
            ['pressed'],
            0.5,
        );
        expect(http.put).toHaveBeenCalledWith(
            url,
            expect.objectContaining({ alpha: '0.5', states: ['pressed'] }),
            expect.anything(),
        );
    });

    it('пишет вложенный стиль ссылкой с состояниями вместо литерала', async () => {
        const reference = { targetAppearanceId: 'child', styleIds: ['child-xs', 'child-default'] };
        await repository.setCombinationValue(
            context,
            'a',
            ['s1', 's2'],
            'buttonStyle',
            'basic-button.xs.default',
            undefined,
            ['pressed'],
            undefined,
            reference,
        );
        expect(http.put).toHaveBeenCalledWith(
            url,
            expect.objectContaining({
                propertyId: 'buttonStyle',
                states: ['pressed'],
                reference,
                value: null,
                tokenId: null,
            }),
            expect.anything(),
        );
        expect(readEditor).not.toHaveBeenCalled();
    });

    it('удаляет пересечение по одному запросу на каждое его значение', async () => {
        http.get.mockResolvedValue({
            data: {
                propertyValues: [
                    { kind: 'combination', propertyId: 'height', styleIds: ['s-pilled', 's-l'], states: [] },
                    { kind: 'combination', propertyId: 'color', styleIds: ['s-l', 's-pilled'], states: ['hovered'] },
                    { kind: 'combination', propertyId: 'height', styleIds: ['s-m', 's-pilled'], states: [] },
                    { kind: 'variation', propertyId: 'height', styleIds: ['s-l'], states: [] },
                ],
            },
        });

        await repository.removeCombination(context, 'a', ['s-l', 's-pilled']);

        expect(http.delete.mock.calls).toEqual([
            [
                url,
                {
                    headers: { 'X-DS-Core-Selection-Revision': '5' },
                    params: { propertyId: 'height', styleIds: 's-pilled,s-l', states: '' },
                },
            ],
            [
                url,
                {
                    headers: { 'X-DS-Core-Selection-Revision': '5' },
                    params: { propertyId: 'color', styleIds: 's-l,s-pilled', states: 'hovered' },
                },
            ],
        ]);
    });
});
