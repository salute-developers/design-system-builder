import { describe, expect, it } from 'vitest';

import { humanizeName } from './text';

describe('humanizeName', () => {
    it('разбивает слова по регистру и сохраняет заглавные сокращения', () => {
        expect(humanizeName('clearContentMarginLeft')).toBe('Clear content margin left');
        expect(humanizeName('largeLMinWidth')).toBe('Large L min width');
        expect(humanizeName('smallXXSMinWidth')).toBe('Small XXS min width');
        expect(humanizeName('mediumMColsCount')).toBe('Medium M cols count');
        expect(humanizeName('h1Color')).toBe('H1 color');
        expect(humanizeName('view')).toBe('View');
    });
});
