import { describe, expect, it } from 'vitest';
import { normalizedColorValue } from './colorValue';

describe('цвета без повторного JSON-кодирования', () => {
    it('раскрывает только сериализованный цвет или ссылку, сохраняя оболочку массива', () => {
        expect(normalizedColorValue(['"#108E26"'])).toEqual(['#108E26']);
        expect(normalizedColorValue('"[general.herbal.400]"')).toBe('[general.herbal.400]');
        expect(normalizedColorValue(['#108E26'])).toEqual(['#108E26']);
    });
    it('не меняет произвольные строки, имена и объекты', () => {
        expect(normalizedColorValue('"Arial"')).toBe('"Arial"');
        expect(normalizedColorValue({ name: '"#108E26"' })).toEqual({ name: '"#108E26"' });
    });
});
