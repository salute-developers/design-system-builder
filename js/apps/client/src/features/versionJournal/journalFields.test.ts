import { describe, expect, it } from 'vitest';

import type { DraftChangeDto } from '../../api/themeEditorRepository';
import { journalColor, journalValueText, presentChangedFields } from './journalFields';

const change: DraftChangeDto = {
    changeId: 'shadow-change',
    versionId: 'draft',
    entityType: 'token-value',
    entityId: 'shadow',
    operation: 'updated',
    changedPaths: ['/value'],
    actorId: null,
    changedAt: '2026-10-19T07:00:00Z',
    editRevision: 1,
    previousValue: { platform: 'web', value: ['0rem 3.75rem 7rem -0.5rem #00000066'] },
    currentValue: { platform: 'web', value: ['0rem 3.75rem 7.0625rem -0.5rem #00000066'] },
};

describe('предметные значения журнала', () => {
    it('раскладывает тень в параметры редактора и показывает только изменённое размытие', () => {
        expect(presentChangedFields([change], new Map(), 'shadow')).toEqual([
            { path: '/value/0/blur', label: 'Слой 1 · Размытие', before: 112, after: 113 },
        ]);
    });

    it('показывает размер в тех же числах, что редактор', () => {
        const fields = presentChangedFields(
            [
                {
                    ...change,
                    previousValue: { platform: 'web', value: '0.5rem' },
                    currentValue: { platform: 'web', value: '0.75rem' },
                },
            ],
            new Map(),
            'spacing',
        );
        expect(fields[0]).toMatchObject({ label: 'Значение', before: 8, after: 12 });
    });

    it('сравнивает старую массивную запись радиуса с новым скалярным значением', () => {
        const fields = presentChangedFields(
            [
                {
                    ...change,
                    previousValue: { platform: 'web', value: ['1rem'] },
                    currentValue: { platform: 'web', value: '1.0625rem' },
                },
            ],
            new Map(),
            'shape',
        );
        expect(fields).toEqual([{ path: '/value', label: 'Значение', before: 16, after: 17 }]);
    });

    it('разрешает палитровую ссылку в цвет и сохраняет подпись источника', () => {
        const reference = '[general.orange.500]';
        expect(journalColor(reference)).toMatch(/^#/);
        expect(journalValueText(reference)).toBe('general.orange.500');
        expect(journalValueText('[general.orange.500][50]')).toBe('general.orange.500 · 50');
        expect(journalColor('[general.unknownShade.9999]')).toBeUndefined();
    });

    it('использует английские названия начертаний', () => {
        expect(journalValueText('400', 'Font weight')).toBe('Regular (400)');
        expect(journalValueText('500', 'Font weight')).toBe('Medium (500)');
        expect(journalValueText('italic', 'Font style')).toBe('Italic');
    });
});
