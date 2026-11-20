import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { otherThemeColorCell } from './otherThemeColorCell';

afterEach(cleanup);

describe('otherThemeColorCell', () => {
    it('показывает HEX цвета без непрозрачной альфы', () => {
        render(otherThemeColorCell(['#0d8523ff']));
        expect(screen.getByTitle('0D8523')).toHaveTextContent('0D8523');
    });

    it('показывает у градиента тип и угол вместо CSS-записи', () => {
        const { container } = render(otherThemeColorCell(['linear-gradient(45deg, #0D8523FF 0%, #0DA8ABFF 100%)']));
        const cell = screen.getByTitle('Линейный · 45°');
        expect(cell).toHaveTextContent('Линейный · 45°');
        expect(cell).not.toHaveTextContent('LINEAR-GRADIENT');
        expect(container.querySelector('i')?.getAttribute('style')).toContain('linear-gradient');
    });

    it('показывает прочерк без значения', () => {
        render(otherThemeColorCell(undefined));
        expect(screen.getByTitle('—')).toHaveTextContent('—');
    });
});
