import { beforeEach, describe, expect, it, vi } from 'vitest';

const http = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), delete: vi.fn() }));
const readEditor = vi.hoisted(() => vi.fn());
vi.mock('./http', () => ({ http }));
vi.mock('./editorReads', () => ({ readEditor, invalidateEditorReads: vi.fn() }));
vi.mock('./editorHttp', () => ({ apiRoot: (projectId: string) => `/api/projects/${projectId}` }));

import { componentStructureRepository as repository } from './componentStructureRepository';

const context = { projectId: 'p', designSystemId: 'ds', tenantId: 't' };
const url = '/api/projects/p/appearances/a/property-values';

describe('componentStructureRepository: пересечения', () => {
    beforeEach(() => {
        Object.values(http).forEach((mock) => mock.mockReset());
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
            [url, { params: { propertyId: 'height', styleIds: 's-pilled,s-l', states: '' } }],
            [url, { params: { propertyId: 'color', styleIds: 's-l,s-pilled', states: 'hovered' } }],
        ]);
    });
});
