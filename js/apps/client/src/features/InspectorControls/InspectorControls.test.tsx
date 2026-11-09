import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { act } from 'react';

import {
    ColorControl,
    NumberControl,
    OpacityControl,
    StateBindingMenu,
    TokenColorLibrary,
    TokenField,
    TokenPicker,
    TypographyCombo,
    parseOpacityPercent,
    type ColorTokenOption,
} from './index';

const tokens = [
    { value: 'round.s', label: 'round.s', hint: '8 px' },
    { value: 'round.m', label: 'round.m', hint: '12 px' },
    { value: 'round.l', label: 'round.l', hint: '16 px' },
];

const colors: ColorTokenOption[] = [
    {
        value: 'text.default.primary',
        label: 'text.default.primary',
        color: '#ffffff',
        group: 'Text',
        subgroup: 'General',
        subtheme: 'default',
    },
    {
        value: 'text.on-dark.primary',
        label: 'text.on-dark.primary',
        color: '#ffffff',
        group: 'Text',
        subgroup: 'General',
        subtheme: 'on-dark',
    },
    {
        value: 'surface.default.accent',
        label: 'surface.default.accent',
        color: '#2a72f8',
        group: 'Surface',
        subgroup: 'Accent',
        subtheme: 'default',
    },
];

afterEach(cleanup);

describe('TokenPicker', () => {
    it('filters by search, marks the selected token and reports an empty result', () => {
        const onSelect = vi.fn();
        render(<TokenPicker options={tokens} value="round.m" onSelect={onSelect} />);

        expect(screen.getByRole('option', { name: /round\.m/ })).toHaveAttribute('aria-selected', 'true');
        fireEvent.change(screen.getByRole('textbox', { name: 'Найти токен' }), { target: { value: 'l' } });
        expect(screen.getAllByRole('option')).toHaveLength(1);
        fireEvent.keyDown(screen.getByRole('textbox', { name: 'Найти токен' }), { key: 'Enter' });
        expect(onSelect).toHaveBeenCalledWith(tokens[2]);

        fireEvent.change(screen.getByRole('textbox', { name: 'Найти токен' }), { target: { value: 'zzz' } });
        expect(screen.getByText('Токены не найдены')).toBeInTheDocument();
    });
});

describe('TokenField', () => {
    it('opens the list, writes the chosen token and closes on Escape', () => {
        const onChange = vi.fn();
        render(<TokenField label="Border radius" value="round.s" options={tokens} mark="↔" onChange={onChange} />);

        fireEvent.click(screen.getByRole('button', { name: 'Border radius' }));
        fireEvent.click(screen.getByRole('option', { name: /round\.l/ }));
        expect(onChange).toHaveBeenCalledWith('round.l');
        expect(screen.queryByRole('listbox')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Border radius' }));
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('listbox')).toBeNull();
    });
    it.each([
        ['down when the list fits below the field', 100, false],
        ['up when there is no room below and more room above', 700, true],
    ])('opens %s', (_, fieldTop, above) => {
        const rect = (top: number, height: number) => ({ top, bottom: top + height, height }) as DOMRect;
        const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
            this: HTMLElement,
        ) {
            if (this.classList.contains('component-token-picker')) return rect(0, 300);
            if (this.classList.contains('component-token-field')) return rect(fieldTop, 24);
            return rect(0, window.innerHeight);
        });
        render(<TokenField label="Shape" value="round.s" options={tokens} onChange={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Shape' }));

        expect(document.querySelector('.component-token-picker')?.classList.contains('is-above')).toBe(above);
        spy.mockRestore();
    });
});

describe('NumberControl', () => {
    it('commits on Enter and reverts a non-numeric value', () => {
        const onCommit = vi.fn();
        render(<NumberControl label="Height" value="40" onCommit={onCommit} />);
        const input = screen.getByRole('textbox', { name: 'Height' });

        fireEvent.change(input, { target: { value: '44' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onCommit).toHaveBeenCalledWith('44');

        fireEvent.change(input, { target: { value: 'abc' } });
        fireEvent.blur(input);
        expect(onCommit).toHaveBeenCalledTimes(1);
        expect(input).toHaveValue('40');
    });

    it('focuses the input on a click anywhere in its frame', () => {
        render(<NumberControl label="Height" value="40" onCommit={vi.fn()} />);

        fireEvent.mouseDown(screen.getByText('px'));

        expect(screen.getByRole('textbox', { name: 'Height' })).toHaveFocus();
    });
});

describe('OpacityControl', () => {
    it('shows percents, stores a ratio and rejects values outside 0–100', () => {
        const onCommit = vi.fn();
        render(<OpacityControl label="Disable alpha" value="0.4" onCommit={onCommit} />);
        const input = screen.getByRole('textbox', { name: 'Disable alpha' });
        expect(input).toHaveValue('40');

        fireEvent.change(input, { target: { value: '55' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onCommit).toHaveBeenCalledWith('0.55');

        fireEvent.change(input, { target: { value: '140' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onCommit).toHaveBeenCalledTimes(1);
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(input).toHaveAttribute('title', 'Введите прозрачность от 0 до 100%');
        expect(parseOpacityPercent('40%')).toBe('0.4');
    });
});

describe('TypographyCombo', () => {
    it('filters by typing and picks the first style on Enter', () => {
        const onChange = vi.fn();
        const styles = [
            { value: 'display.s.normal', label: 'display.s.normal' },
            { value: 'body.m.normal', label: 'body.m.normal' },
        ];
        render(<TypographyCombo label="Text style" value="display.s.normal" options={styles} onChange={onChange} />);
        const input = screen.getByRole('combobox', { name: 'Text style' });

        fireEvent.focus(input);
        expect(screen.getByText('Стили текущей темы')).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /display\.s\.normal/ })).toHaveAttribute('aria-selected', 'true');
        fireEvent.change(input, { target: { value: 'body' } });
        expect(screen.getAllByRole('option')).toHaveLength(1);
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onChange).toHaveBeenCalledWith('body.m.normal');
    });

    it('stays closed when Escape returns the focus to the field', () => {
        vi.useFakeTimers();
        const styles = [{ value: 'body.m.normal', label: 'body.m.normal' }];
        render(<TypographyCombo label="Text style" options={styles} onChange={vi.fn()} />);
        const input = screen.getByRole('combobox', { name: 'Text style' });

        fireEvent.focus(input);
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        act(() => {
            fireEvent.keyDown(document, { key: 'Escape' });
            fireEvent.focus(input);
        });
        expect(screen.queryByText('Стили текущей темы')).toBeNull();

        act(() => vi.runAllTimers());
        fireEvent.focus(input);
        expect(screen.getByText('Стили текущей темы')).toBeInTheDocument();
        vi.useRealTimers();
    });
});

describe('ColorControl', () => {
    const field = (label: string) => (
        <ColorControl label={label} value="" color="" linked={false} tokens={colors} onChange={vi.fn()} />
    );

    it('keeps a single picker open when another colour field is clicked', () => {
        render(
            <>
                {field('Background')}
                {field('Color')}
            </>,
        );
        const background = screen.getByRole('button', { name: 'Background' });
        const color = screen.getByRole('button', { name: 'Color' });

        fireEvent.click(background);
        expect(background).toHaveAttribute('aria-expanded', 'true');
        fireEvent.mouseDown(color);
        fireEvent.click(color);

        expect(background).toHaveAttribute('aria-expanded', 'false');
        expect(color).toHaveAttribute('aria-expanded', 'true');
    });

    it('closes the picker when the focus moves into the preview frame', () => {
        vi.useFakeTimers();
        render(
            <>
                {field('Background')}
                <iframe title="preview" />
            </>,
        );
        const background = screen.getByRole('button', { name: 'Background' });
        fireEvent.click(background);

        act(() => {
            screen.getByTitle('preview').focus();
            window.dispatchEvent(new Event('blur'));
            vi.runAllTimers();
        });

        expect(background).toHaveAttribute('aria-expanded', 'false');
        vi.useRealTimers();
    });
});

describe('TokenColorLibrary', () => {
    beforeEach(() => localStorage.removeItem('sdds-color-library-preferences'));

    it('groups tokens, hides subtheme tokens until asked and remembers the choice', () => {
        const onPick = vi.fn();
        const view = render(<TokenColorLibrary options={colors} value="surface.default.accent" onPick={onPick} />);

        expect(screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent)).toEqual([
            'Text',
            'Surface',
        ]);
        expect(screen.queryByText('text.on-dark.primary')).toBeNull();
        expect(screen.getByRole('button', { name: 'surface.default.accent' })).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(screen.getByRole('checkbox', { name: 'Токены подтем' }));
        expect(screen.getByText('text.on-dark.primary')).toBeInTheDocument();
        fireEvent.change(screen.getByRole('textbox', { name: 'Найти токен цвета' }), { target: { value: 'accent' } });
        fireEvent.click(screen.getByText('surface.default.accent'));
        expect(onPick).toHaveBeenCalledWith(colors[2]);

        view.unmount();
        render(<TokenColorLibrary options={colors} onPick={onPick} />);
        expect(screen.getByRole('checkbox', { name: 'Токены подтем' })).toHaveAttribute('aria-checked', 'true');
    });
});

describe('StateBindingMenu', () => {
    it('adds one state from all checked options in the prototype order', () => {
        const onAdd = vi.fn();
        render(<StateBindingMenu label="Background" onAdd={onAdd} />);

        fireEvent.click(screen.getByRole('button', { name: 'Добавить состояние: Background' }));
        const menu = screen.getByRole('menu', { name: 'Состояния' });
        expect(within(menu).getByRole('button', { name: 'Добавить' })).toBeDisabled();
        fireEvent.click(within(menu).getByRole('menuitemcheckbox', { name: /hovered/ }));
        fireEvent.click(within(menu).getByRole('menuitemcheckbox', { name: /pressed/ }));
        fireEvent.click(within(menu).getByRole('button', { name: 'Добавить · 2' }));

        expect(onAdd).toHaveBeenCalledWith(['pressed', 'hovered']);
        expect(screen.queryByRole('menu')).toBeNull();
    });
});
