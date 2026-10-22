import { describe, expect, it } from 'vitest';
import type { DraftChangeDto } from '../../api/editorContracts';
import { presentPaletteChange } from './paletteJournalPresentation';

const location = {
    tenant_id: 'theme',
    group_id: 'group',
    group_label: 'Акцентные',
    slot_type: 'general',
    slot_shade: 'amber',
};
const change: DraftChangeDto = {
    changeId: 'rebuild',
    versionId: 'draft',
    entityType: 'palette-ramp',
    entityId: 'ramp',
    operation: 'updated',
    actorId: 'user',
    changedAt: '2026-10-20T12:00:00Z',
    editRevision: 1,
    changedPaths: ['/origin', '/anchor_value', '/steps'],
    previousValue: {
        ...location,
        source_type: 'general',
        source_shade: 'amber',
        origin: 'template',
        steps: { 500: '#112233' },
    },
    currentValue: {
        ...location,
        source_type: 'general',
        source_shade: 'amber',
        origin: 'rebuild',
        anchor_step: 500,
        anchor_value: '#445566',
        steps: { 500: '#445566' },
    },
};

describe('представление изменений палитры', () => {
    it('показывает перестроение без технических полей, с группой и цветами', () => {
        const result = presentPaletteChange(change, new Map());
        expect(result?.title).toBe('Перестроение растяжки: Amber');
        expect(result?.groupLabel).toBe('Акцентные');
        expect(result?.fields).toEqual([
            { path: '/anchor_step', label: 'Опорная ступень', before: undefined, after: 500 },
            { path: '/anchor_value', label: 'Цвет для перестроения', before: undefined, after: '#445566' },
        ]);
        expect(result?.paletteSteps).toEqual([{ step: 500, before: '#112233', after: '#445566' }]);
    });

    it('сравнивает реальные параметры, если исходная растяжка уже была перестроена', () => {
        const result = presentPaletteChange(
            {
                ...change,
                previousValue: {
                    ...change.previousValue,
                    origin: 'rebuild',
                    anchor_step: 400,
                    anchor_value: '#ABCDEF',
                },
            },
            new Map(),
        );
        expect(result?.fields).toEqual([
            { path: '/anchor_step', label: 'Опорная ступень', before: 400, after: 500 },
            { path: '/anchor_value', label: 'Цвет для перестроения', before: '#ABCDEF', after: '#445566' },
        ]);
    });

    it('показывает ручную правку отдельно, без параметров растяжки', () => {
        const result = presentPaletteChange(
            {
                ...change,
                entityType: 'palette-step',
                previousValue: { ...location, step: 600, value: '#112233' },
                currentValue: { ...location, step: 600, value: '#778899' },
            },
            new Map(),
        );
        expect(result?.title).toBe('Ступень палитры: Amber 600');
        expect(result?.fields).toEqual([{ path: '/value', label: 'Цвет', before: '#112233', after: '#778899' }]);
        expect(result?.paletteSteps).toBeUndefined();
    });
});
