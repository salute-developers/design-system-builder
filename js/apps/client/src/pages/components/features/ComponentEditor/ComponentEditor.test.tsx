import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Config } from '../../../../controllers';
import type { DesignSystem, Theme } from '../../../../controllers';
import { chipMeta } from '../__fixtures__/chipMeta';

// Превью рисует плагин в iframe: здесь достаточно заголовка, аргументов, которые оно получает, и аргументов story,
// которые оно отдаёт инспектору.
const storyArgChanges = vi.hoisted(() => vi.fn());
vi.mock('../ComponentEditorPreview', async () => {
    const { useEffect, useState } = await import('react');
    return {
        ComponentEditorPreview: ({
            title,
            args,
            onStoryArgsChange,
        }: {
            title: string;
            args: Record<string, unknown>;
            onStoryArgsChange?: (storyArgs: unknown) => void;
        }) => {
            const [values, setValues] = useState<Record<string, unknown>>({});
            useEffect(() => {
                onStoryArgsChange?.({
                    key: 'web:Chip:Default',
                    properties: [
                        { type: 'boolean', name: 'disabled', defaultValue: false },
                        { type: 'string', name: 'text', defaultValue: 'Text' },
                    ],
                    values,
                    onChange: (name: string, value: unknown) => {
                        storyArgChanges(name, value);
                        setValues((current) => ({ ...current, [name]: value }));
                    },
                });
            }, [onStoryArgsChange, values]);
            return (
                <div data-testid="preview" data-args={JSON.stringify(args)} data-story-args={JSON.stringify(values)}>
                    {title}
                </div>
            );
        },
    };
});

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

    it('shows story arguments after the variations and changes only the preview', () => {
        renderEditor();
        const variants = section('Variants');

        fireEvent.click(within(variants).getByRole('switch', { name: 'Disabled' }));
        fireEvent.change(within(variants).getByRole('textbox', { name: 'Text' }), { target: { value: 'Hello' } });

        expect(storyArgChanges).toHaveBeenCalledWith('disabled', true);
        expect(JSON.parse(screen.getByTestId('preview').dataset.storyArgs ?? '{}')).toEqual({
            disabled: true,
            text: 'Hello',
        });
        // Аргументы story не входят в сочетание вариаций.
        expect(previewArgs()).toEqual({ size: 's-m', view: 'v-default' });
        expect(within(variants).getByRole('textbox', { name: 'Text' })).toHaveValue('Hello');
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
            config.getStyleByVariation('v-view', styleID)?.getProps().getProp('background')?.getValue();
        expect(background('v-default')).toBe('surfaceAccent');
        expect(background('v-accent')).toBe('surfaceAccent');
        expect(config.getInvariants().getProp('background')).toBeUndefined();
    });

    it('writes a dimension into the selected size style', () => {
        const { config } = renderEditor();

        const height = screen.getByRole('textbox', { name: 'Height' });
        fireEvent.change(height, { target: { value: '44' } });
        fireEvent.keyDown(height, { key: 'Enter' });

        expect(config.getStyleByVariation('v-size', 's-m')?.getProps().getProp('height')?.getValue()).toBe('44');
        expect(config.getStyleByVariation('v-size', 's-xs')?.getProps().getProp('height')).toBeUndefined();
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

    it('shows an icon through the catalog picker and keeps the generic clear button off it', () => {
        renderEditor();

        const group = screen.getByRole('region', { name: 'Behaviour' });
        fireEvent.click(within(group).getByRole('button', { name: 'Behaviour' }));

        // Каталога в тесте нет: пикер показывает значение строкой, как до выбора из каталога.
        expect(within(property('closeIcon')).getByText('close.16')).not.toBeNull();
        expect(within(property('closeIcon')).queryByRole('button', { name: /Очистить значение/ })).toBeNull();
        expect(within(property('closeIcon')).getByRole('button', { name: /Очистить/ })).not.toBeNull();
    });

    it('hides unset rows of a group with its filter', () => {
        renderEditor();

        const color = section('Color');
        expect(property('focusColor')).not.toBeNull();
        fireEvent.click(within(color).getByRole('button', { name: 'Фильтр Color' }));
        expect(property('focusColor')).toBeNull();
        expect(property('background')).not.toBeNull();
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
