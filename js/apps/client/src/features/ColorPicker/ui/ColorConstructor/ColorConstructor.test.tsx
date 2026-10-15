import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ColorConstructor } from './ColorConstructor';

beforeEach(() => {
    // Компонентам Plasma нужны API браузера, которых нет в jsdom.
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    Object.defineProperty(document, 'fonts', { value: { ready: Promise.resolve() }, configurable: true });
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

const field = () => screen.getByRole('textbox') as HTMLInputElement;

// Подписи HEX/RGB/HSL есть и у строк копирования ниже: пункт списка — тот, что появился после открытия.
const selectFormat = (from: string, to: string) => {
    const before = new Set(screen.queryAllByText(to));
    fireEvent.click(screen.getAllByText(from)[0]);
    fireEvent.click(screen.getAllByText(to).find((element) => !before.has(element))!);
};

describe('ColorConstructor', () => {
    it('показывает цвет в выбранном формате и принимает правку в нём', () => {
        const onChange = vi.fn();
        render(<ColorConstructor color="#1A9E32" opacity={1} hideOpacity onChange={onChange} onOpacityChange={() => undefined} />);
        expect(field().value).toBe('#1A9E32');

        selectFormat('HEX', 'RGB');
        expect(field().value).toBe('rgb(26, 158, 50)');
        fireEvent.change(field(), { target: { value: 'rgb(0, 128, 0)' } });
        fireEvent.blur(field());
        expect(onChange).toHaveBeenCalledWith('rgb(0, 128, 0)');

        selectFormat('RGB', 'HSL');
        expect(field().value).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
    });
});
