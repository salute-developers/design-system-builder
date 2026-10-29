import { describe, expect, it } from 'vitest';

import type { ComponentConfig } from '../controllers';
import { componentChanges } from './componentAutosave';

const config = (): ComponentConfig => ({
    defaultVariations: [{ variationID: 'size', styleID: 'm' }],
    invariantProps: [{ id: 'background', value: 'surface.default' }],
    variations: [
        {
            id: 'size',
            styles: [
                {
                    id: 'm',
                    name: 'm',
                    intersections: null,
                    props: [{ id: 'height', value: 40, states: [{ state: ['hovered'], value: 42 }] }],
                },
            ],
        },
    ],
});

describe('componentChanges', () => {
    it('выделяет только изменённую предметную строку свойства', () => {
        const before = config();
        const after = structuredClone(before);
        after.variations[0].styles![0].props![0].value = 48;

        expect(componentChanges(before, after)).toEqual([
            {
                kind: 'property',
                action: 'upsert',
                propertyId: 'height',
                variationId: 'size',
                styleId: 'm',
                stateNames: [],
                value: 48,
                adjustment: undefined,
            },
        ]);
    });

    it('отдельно описывает значение по умолчанию, новый стиль и состояние свойства', () => {
        const before = config();
        const after = structuredClone(before);
        after.defaultVariations[0].styleID = 'l';
        after.variations[0].styles!.push({
            id: 'l',
            name: 'l',
            intersections: null,
            props: [{ id: 'height', value: 56 }],
        });
        after.variations[0].styles![0].props![0].states![0].value = 44;

        expect(componentChanges(before, after)).toEqual(
            expect.arrayContaining([
                { kind: 'default', variationId: 'size', styleId: 'l' },
                { kind: 'style', action: 'create', variationId: 'size', styleId: 'l', name: 'l' },
                expect.objectContaining({
                    kind: 'property',
                    action: 'upsert',
                    propertyId: 'height',
                    styleId: 'm',
                    stateNames: ['hovered'],
                    value: 44,
                }),
            ]),
        );
    });

    it('снимает значение по умолчанию перед удалением выбранного стиля', () => {
        const before = config();
        const after = structuredClone(before);
        after.variations[0].styles = [];

        expect(componentChanges(before, after)).toEqual(
            expect.arrayContaining([
                { kind: 'default', variationId: 'size', styleId: null },
                { kind: 'style', action: 'delete', variationId: 'size', styleId: 'm' },
            ]),
        );
    });
});
