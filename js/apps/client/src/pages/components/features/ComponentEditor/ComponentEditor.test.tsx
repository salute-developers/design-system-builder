import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Config } from '../../../../controllers';
import type { DesignSystem, Theme } from '../../../../controllers';
import { chipMeta } from '../__fixtures__/chipMeta';

// Превью рисует плагин в iframe: здесь достаточно заголовка и аргументов, которые оно получает.
vi.mock('../ComponentEditorPreview', () => ({
    ComponentEditorPreview: ({ title, args }: { title: string; args: Record<string, unknown> }) => (
        <div data-testid="preview" data-args={JSON.stringify(args)}>
            {title}
        </div>
    ),
}));

import { ComponentEditor } from './ComponentEditor';

const colorToken = (name: string) => ({
    getEnabled: () => true,
    getTags: () => ['dark'],
    getName: () => `dark.${name}`,
    getValue: () => '#ffffff',
});

const theme = {
    getTokens: (type: string) =>
        type === 'color' ? ['surfaceSolidDefault', 'surfaceAccent', 'textAccent'].map(colorToken) : [],
    getRevision: () => 0,
    getTokenValue: () => undefined,
} as unknown as Theme;

const designSystem = {
    getComponentData: () => ({ sources: chipMeta.sources }),
    resolveComposeStyleReference: vi.fn(),
} as unknown as DesignSystem;

const renderEditor = () => {
    const config = new Config(chipMeta);
    const onConfigUpdate = vi.fn();
    const view = render(
        <MemoryRouter>
            <ComponentEditor
                designSystem={designSystem}
                theme={theme}
                configs={[config]}
                updated={{}}
                platforms={[]}
                onPlatformSelect={vi.fn()}
                onConfigUpdate={onConfigUpdate}
            />
        </MemoryRouter>,
    );
    const rerender = () =>
        view.rerender(
            <MemoryRouter>
                <ComponentEditor
                    designSystem={designSystem}
                    theme={theme}
                    configs={[config]}
                    updated={{}}
                    platforms={[]}
                    onPlatformSelect={vi.fn()}
                    onConfigUpdate={onConfigUpdate}
                />
            </MemoryRouter>,
        );
    onConfigUpdate.mockImplementation(rerender);
    return { config, onConfigUpdate };
};

const previewArgs = () => JSON.parse(screen.getByTestId('preview').dataset.args ?? '{}');
const section = (name: string) => screen.getAllByRole('region', { name })[0];
const property = (name: string) => document.querySelector(`[data-property="${name}"]`) as HTMLElement;

describe('ComponentEditor', () => {
    // Поле поиска выпадающего списка токенов ждёт загрузки шрифтов, которой в jsdom нет.
    beforeEach(() => {
        Object.defineProperty(document, 'fonts', { value: { ready: Promise.resolve() }, configurable: true });
    });
    afterEach(cleanup);

    it('opens with the default combination in the preview and the inspector', () => {
        renderEditor();

        expect(screen.getByTestId('preview')).toHaveTextContent('Chip M Default');
        expect(previewArgs()).toEqual({ size: 's-m', view: 'v-default' });
        expect(screen.getByRole('tab', { name: 'Стилизация' })).toHaveAttribute('aria-selected', 'true');
        expect(within(property('background')).getByTitle('Background · view: default')).toBeInTheDocument();
        expect(within(section('Size')).getByText('Height')).toBeInTheDocument();
        expect(within(section('Text')).getByText('Typography')).toBeInTheDocument();
    });

    it('changes the combination of the preview and the property rows from Variants', () => {
        renderEditor();

        fireEvent.change(screen.getByRole('combobox', { name: 'View' }), { target: { value: 'v-accent' } });

        expect(previewArgs()).toEqual({ size: 's-m', view: 'v-accent' });
        expect(within(property('background')).getByTitle('Background · view: accent')).toBeInTheDocument();
        expect(within(property('background')).getByText('surfaceAccent')).toBeInTheDocument();
    });

    it('switches a flag on and off with its argument and style properties', () => {
        renderEditor();
        expect(property('pilledBorderRadius')).toBeNull();

        fireEvent.click(screen.getByRole('switch', { name: 'Pilled' }));
        expect(previewArgs()).toEqual({ size: 's-m', view: 'v-default', pilled: 'p-true' });
        expect(within(section('Appearance')).getByText('Pilled border radius')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('switch', { name: 'Pilled' }));
        expect(previewArgs()).toEqual({ size: 's-m', view: 'v-default' });
        expect(property('pilledBorderRadius')).toBeNull();
    });

    it('writes a colour token into the source style only', () => {
        const { config, onConfigUpdate } = renderEditor();

        fireEvent.click(screen.getByRole('button', { name: 'Background' }));
        // Значение — токен: пикер открывается на вкладке «Библиотека».
        fireEvent.click(within(document.querySelector('.cp-library') as HTMLElement).getByText('surfaceAccent'));

        expect(onConfigUpdate).toHaveBeenCalled();
        const background = (styleID: string) =>
            config.getStyleByVariation('view', styleID)?.getProps().getProp('background')?.getValue();
        expect(background('v-default')).toBe('surfaceAccent');
        expect(background('v-accent')).toBe('surfaceAccent');
        expect(config.getInvariants().getProp('background')).toBeUndefined();
    });

    it('writes a dimension into the selected size style', () => {
        const { config } = renderEditor();

        const height = screen.getByRole('textbox', { name: 'Height' });
        fireEvent.change(height, { target: { value: '44' } });
        fireEvent.keyDown(height, { key: 'Enter' });

        expect(config.getStyleByVariation('size', 's-m')?.getProps().getProp('height')?.getValue()).toBe('44');
        expect(config.getStyleByVariation('size', 's-xs')?.getProps().getProp('height')).toBeUndefined();
    });

    it('shows unset properties as empty rows, fills and clears them', () => {
        const { config } = renderEditor();
        const focus = () => config.getInvariants().getProp('focus');

        // Дополнительной группы Color нет: цвета живут в секции Color.
        expect(screen.getAllByRole('region', { name: 'Color' })).toHaveLength(1);
        expect(within(property('focusColor')).getByRole('button', { name: 'Focus color' })).toHaveTextContent(
            'Не задано',
        );
        expect(focus()).toBeUndefined();

        fireEvent.click(within(property('focusColor')).getByRole('button', { name: 'Focus color' }));
        fireEvent.click(within(document.querySelector('.cp-library') as HTMLElement).getByText('textAccent'));
        expect(focus()?.getValue()).toBe('textAccent');

        fireEvent.click(screen.getByRole('button', { name: 'Очистить значение: Focus color' }));
        expect(focus()).toBeUndefined();
        expect(within(property('focusColor')).getByRole('button', { name: 'Focus color' })).toHaveTextContent(
            'Не задано',
        );
    });

    it('does not clear icons and style links: they cannot be set again yet', () => {
        renderEditor();

        const group = screen.getByRole('region', { name: 'Behaviour' });
        fireEvent.click(within(group).getByRole('button', { name: 'Behaviour' }));

        expect(within(property('closeIcon')).getByRole('textbox', { name: 'Close icon' })).toHaveValue('close.16');
        expect(within(property('closeIcon')).queryByRole('button', { name: /Очистить значение/ })).toBeNull();
    });

    it('hides unset rows of a group with its filter', () => {
        renderEditor();

        const color = section('Color');
        expect(property('focusColor')).not.toBeNull();
        fireEvent.click(within(color).getByRole('button', { name: 'Фильтр Color' }));
        expect(property('focusColor')).toBeNull();
        expect(property('background')).not.toBeNull();
    });

    it('adds a style from the temporary variation menu and selects it', () => {
        const { config } = renderEditor();

        fireEvent.click(screen.getByRole('button', { name: 'Стили view' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Добавить стиль' }));
        const input = screen.getByRole('textbox', { name: 'Новый стиль view' });
        fireEvent.change(input, { target: { value: 'brand!' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        const brand = config
            .getVariation('view')
            ?.getStyles()
            ?.find((item) => item.getName() === 'brand');
        expect(brand).toBeDefined();
        expect(previewArgs().view).toBe(brand?.getID());
        expect(screen.getByTestId('preview')).toHaveTextContent('Chip M Brand');
        // Новый стиль пуст: свойства его вариации показаны пустыми строками и в модели не заводятся.
        expect(brand?.getProps().getList()).toEqual([]);
        expect(within(property('background')).getByTitle('Background · view: brand')).toBeInTheDocument();
        expect(within(property('color')).getByRole('button', { name: 'Color' })).toHaveTextContent('Не задано');
    });

    it('keeps the combination when the same component is reloaded after autosave', () => {
        const element = (config: Config) => (
            <MemoryRouter>
                <ComponentEditor
                    designSystem={designSystem}
                    theme={theme}
                    configs={[config]}
                    updated={{}}
                    platforms={[]}
                    onPlatformSelect={vi.fn()}
                    onConfigUpdate={vi.fn()}
                />
            </MemoryRouter>
        );
        const view = render(element(new Config(chipMeta)));
        fireEvent.change(screen.getByRole('combobox', { name: 'View' }), { target: { value: 'v-accent' } });

        view.rerender(element(new Config(chipMeta)));

        expect(previewArgs()).toEqual({ size: 's-m', view: 'v-accent' });
        expect(screen.getByTestId('preview')).toHaveTextContent('Chip M Accent');
    });
});
