import { describe, expect, it } from 'vitest';

import { splitTopLevel, validateColorValue } from '../../../modules/colorTokens';
import { gradientToCss, parseLinearGradient } from './colorMath';

// Значение `surface.default.skeleton-gradient` из `controllers/themeBuilder/tokens/gradient/default/web.ts`.
const SKELETON =
    'linear-gradient(90deg, rgba(255, 255, 255, 0.09) 0%, rgba(255, 255, 255, 0.08) 6.25%, rgba(255, 255, 255, 0.05) 12.5%, rgba(255, 255, 255, 0.09) 100%)';

describe('градиенты в выборе цвета', () => {
    it('делит значение только по запятым верхнего уровня', () => {
        expect(splitTopLevel(`${SKELETON}, #FFFFFF`)).toEqual([SKELETON, '#FFFFFF']);
        expect(splitTopLevel('linear-gradient(45deg, #000 0%, #FFF 100%)')).toHaveLength(1);
    });

    it('разбирает стопы rgba с дробными позициями и не меняет неизменённые стопы', () => {
        const gradient = parseLinearGradient(SKELETON);
        expect(gradient?.angle).toBe(90);
        expect(gradient?.stops.map((stop) => [stop.color, stop.position])).toEqual([
            ['#FFFFFF17', 0],
            ['#FFFFFF14', 6.25],
            ['#FFFFFF0D', 12.5],
            ['#FFFFFF17', 100],
        ]);
        expect(gradientToCss(gradient!)).toBe(SKELETON);
    });

    it('сохраняет дробный угол и пишет изменённый стоп в HEX', () => {
        const gradient = parseLinearGradient('linear-gradient(45.50deg, #0D8523FF 0%, #0DA8ABFF 99.688%)')!;
        const next = { ...gradient, stops: [{ color: '#000000', position: 0 }, gradient.stops[1]] };
        expect(gradientToCss(next)).toBe('linear-gradient(45.5deg, #000000 0%, #0DA8ABFF 99.688%)');
    });

    it('не разбирает градиент в неподдерживаемом виде', () => {
        expect(parseLinearGradient('linear-gradient(to right, red, blue)')).toBeNull();
    });

    it('не считает градиент с rgba ошибкой значения', () => {
        const field = { value: SKELETON, resolved: SKELETON, opacity: 1, paletteLabel: null };
        expect(validateColorValue(field as never, 'gradient')).toBeNull();
    });
});
