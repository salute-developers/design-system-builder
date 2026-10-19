import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { formulas } from './formulas';

describe('общие операции цветовых формул', () => {
    it('сохраняет все диапазоны, порядок правил и результаты прежней таблицы', () => {
        // Отпечаток снят до рефакторинга с полной таблицы и результатов каждой операции.
        // Строковое кодирование различает NaN, бесконечности и отрицательный ноль.
        const samples = [-Infinity, -1, -0, 0, 0.01, 0.1, 0.5, 1, 25.5, 50, 99.5, 100, 101, Infinity, NaN];
        const evaluated = JSON.stringify(formulas, (_key, value) => {
            if (typeof value !== 'function') return value;
            return samples.map((input) => {
                const output = value(input);
                return Object.is(output, -0) ? '-0' : String(output);
            });
        });
        expect(createHash('sha256').update(evaluated).digest('hex')).toBe(
            'c7d9f222cda4170d990fab6af8254db3c9138426108b6971429d6667349c7667',
        );
    });

    it('переиспользует одинаковые операции вместо создания сотен функций', () => {
        const operations: Array<(value: number) => number> = [];
        JSON.stringify(formulas, (_key, value) => {
            if (typeof value === 'function') operations.push(value);
            return value;
        });
        expect(operations).toHaveLength(408);
        expect(new Set(operations).size).toBe(60);
    });
});
