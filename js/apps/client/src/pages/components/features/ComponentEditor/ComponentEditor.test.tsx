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

/** Пустые свойства по умолчанию скрыты фильтром секций: тесты пустых строк выключают его во всех секциях. */
const showEmptyRows = () =>
    screen
        .getAllByRole('button', { name: /^Фильтр / })
        .filter((button) => button.getAttribute('aria-pressed') === 'true')
        .forEach((button) => fireEvent.click(button));

const previewArgs = () => JSON.parse(screen.getByTestId('preview').dataset.args ?? '{}');
const section = (name: string) => screen.getAllByRole('region', { name })[0];
const property = (name: string) => document.querySelector(`[data-property="${name}"]`) as HTMLElement;

describe('ComponentEditor: блок «Конфигурация»', () => {
    afterEach(cleanup);

    it('показывает выбор конфигурации отдельным блоком над вариациями', () => {
        const meta = {
            ...chipMeta,
            sources: {
                ...chipMeta.sources,
                configs: [
                    { ...chipMeta.sources.configs[0], id: 'base', name: 'default', isDefault: true },
                    { ...chipMeta.sources.configs[0], id: 'copy', name: 'default-copy', isDefault: false },
                ],
            },
        } as typeof chipMeta;
        render(
            <MemoryRouter>
                <ComponentEditor
                    designSystem={designSystem}
                    theme={theme}
                    configs={[new Config(meta)]}
                    updated={{}}
                    platforms={[]}
                    onPlatformSelect={vi.fn()}
                    onConfigUpdate={vi.fn()}
                    onConfigurationSelect={vi.fn()}
                />
            </MemoryRouter>,
        );

        const configuration = screen.getByRole('region', { name: 'Конфигурация' });
        const variations = screen.getByRole('region', { name: 'Вариации' });
        expect(within(configuration).getByRole('combobox', { name: 'Конфигурация' })).toBeInTheDocument();
        expect(within(variations).queryByRole('combobox', { name: 'Конфигурация' })).toBeNull();
        expect(configuration.compareDocumentPosition(variations) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
});

describe('ComponentEditor: переход из «Доступности»', () => {
    afterEach(cleanup);

    it('выбирает стиль пары один раз: перечитанная конфигурация не сбрасывает выбор', () => {
        const entries = [{ pathname: '/', state: { preview: { variation: 'view', style: 'accent', mode: 'dark' } } }];
        const editor = (config: Config) => (
            <MemoryRouter initialEntries={entries}>
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
        const view = render(editor(new Config(chipMeta)));

        expect(screen.getByRole('combobox', { name: 'View' })).toHaveValue('v-accent');
        expect(screen.getByRole('combobox', { name: 'Size' })).toHaveValue('');

        fireEvent.change(screen.getByRole('combobox', { name: 'Size' }), { target: { value: 's-m' } });
        // Автосохранение перечитывает компонент: приходит новый экземпляр конфигурации.
        view.rerender(editor(new Config(chipMeta)));

        expect(screen.getByRole('combobox', { name: 'View' })).toHaveValue('v-accent');
        expect(screen.getByRole('combobox', { name: 'Size' })).toHaveValue('s-m');
    });
});

describe('ComponentEditor', () => {
    // Поле поиска выпадающего списка токенов ждёт загрузки шрифтов, которой в jsdom нет.
    beforeEach(() => {
        Object.defineProperty(document, 'fonts', { value: { ready: Promise.resolve() }, configurable: true });
    });
    afterEach(cleanup);

    it('opens with nothing selected: the inspector edits the invariant, the preview draws the defaults', () => {
        renderEditor();
        showEmptyRows();

        expect(screen.getByTestId('preview')).toHaveTextContent('Chip M Default');
        expect(previewArgs()).toEqual({ size: 's-m', view: 'v-default' });
        expect(screen.getByRole('tab', { name: 'Стилизация' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('combobox', { name: 'Size' })).toHaveValue('');
        expect(screen.getByRole('combobox', { name: 'View' })).toHaveValue('');
        // «Все варианты» — первый пункт списка вариации: вариация не выбрана.
        expect(within(screen.getByRole('combobox', { name: 'Size' })).getAllByRole('option')[0]).toHaveTextContent(
            'Все варианты',
        );
        expect(property('background').querySelector('[data-tooltip="Background · Инвариант"]')).toBeInTheDocument();
        expect(within(section('Размер')).getByText('Height')).toBeInTheDocument();
        expect(within(section('Текст')).getByText('Typography')).toBeInTheDocument();
    });

    it('edits the intersection when two variations are selected and the style after one is cleared', () => {
        renderEditor();
        showEmptyRows();

        fireEvent.change(screen.getByRole('combobox', { name: 'Size' }), { target: { value: 's-m' } });
        fireEvent.change(screen.getByRole('combobox', { name: 'View' }), { target: { value: 'v-accent' } });
        // Height не задан на пересечении: он унаследован от `size: m`, его видно, но сбросить нельзя.
        expect(property('height').querySelector('[data-tooltip="Height · size: m"]')).toBeInTheDocument();
        expect(property('height')).toHaveClass('is-inherited');
        expect(within(property('height')).queryByRole('button', { name: /Очистить значение/ })).toBeNull();
        expect(document.querySelectorAll('[data-property="height"]')).toHaveLength(1);

        fireEvent.change(screen.getByRole('combobox', { name: 'Size' }), { target: { value: '' } });
        expect(property('height').querySelector('[data-tooltip="Height · view: accent"]')).toBeInTheDocument();
        expect(previewArgs()).toEqual({ size: 's-m', view: 'v-accent' });
    });

    it('keeps inherited values of an intersection visible with the filter on', () => {
        renderEditor();

        fireEvent.change(screen.getByRole('combobox', { name: 'Size' }), { target: { value: 's-m' } });
        fireEvent.change(screen.getByRole('combobox', { name: 'View' }), { target: { value: 'v-accent' } });

        // Фильтр включён по умолчанию: унаследованные значения видны, пустые строки скрыты.
        expect(property('height')).toHaveClass('is-inherited');
        expect(property('background').querySelector('[data-tooltip="Background · view: accent"]')).toBeInTheDocument();
        expect(property('pilledBorderRadius')).toBeNull();
    });

    it('changes the combination of the preview and the property rows from Variants', () => {
        renderEditor();

        fireEvent.change(screen.getByRole('combobox', { name: 'View' }), { target: { value: 'v-accent' } });

        // Не выбранный Size превью рисует стилем по умолчанию.
        expect(previewArgs()).toEqual({ size: 's-m', view: 'v-accent' });
        expect(property('background').querySelector('[data-tooltip="Background · view: accent"]')).toBeInTheDocument();
        expect(within(property('background')).getByText('surfaceAccent')).toBeInTheDocument();
    });

    it('shows story arguments in their own Preview group and changes only the preview', () => {
        renderEditor();
        const preview = section('Предпросмотр');
        // Вариации и параметры story — в разных секциях.
        expect(within(section('Вариации')).queryByRole('switch', { name: 'Disabled' })).toBeNull();
        expect(within(preview).queryByRole('combobox', { name: 'Size' })).toBeNull();

        fireEvent.click(within(preview).getByRole('switch', { name: 'Disabled' }));
        fireEvent.change(within(preview).getByRole('textbox', { name: 'Text' }), { target: { value: 'Hello' } });

        expect(storyArgChanges).toHaveBeenCalledWith('disabled', true);
        expect(JSON.parse(screen.getByTestId('preview').dataset.storyArgs ?? '{}')).toEqual({
            disabled: true,
            text: 'Hello',
        });
        // Аргументы story не входят в сочетание вариаций.
        expect(previewArgs()).toEqual({ size: 's-m', view: 'v-default' });
        expect(within(preview).getByRole('textbox', { name: 'Text' })).toHaveValue('Hello');
    });

    it('lets a viewer switch variations while the property fields stay inactive', () => {
        render(
            <MemoryRouter>
                <ComponentEditor
                    designSystem={designSystem}
                    theme={theme}
                    configs={[new Config(chipMeta)]}
                    updated={{}}
                    platforms={[]}
                    onPlatformSelect={vi.fn()}
                    onConfigUpdate={vi.fn()}
                    readOnly
                />
            </MemoryRouter>,
        );

        fireEvent.change(screen.getByRole('combobox', { name: 'View' }), { target: { value: 'v-accent' } });
        expect(previewArgs()).toEqual({ size: 's-m', view: 'v-accent' });
        // Поля неактивны, но остаются в дереве доступности: значение читается.
        const background = property('background');
        within(background)
            .getAllByRole('button')
            .forEach((button) => expect(button).toBeDisabled());
        expect(background.closest('section')).not.toHaveAttribute('aria-hidden');

        // Фильтр и сворачивание секций работают и в режиме просмотра.
        const filter = within(section('Цвет')).getByRole('button', { name: 'Фильтр Цвет' });
        expect(filter).toBeEnabled();
        fireEvent.click(filter);
        expect(filter).toHaveAttribute('aria-pressed', 'false');
        const toggle = section('Цвет').querySelector('.component-variation-type-toggle') as HTMLElement;
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });

    it('shows a raw CSS value as text without a unit and saves it as typed', () => {
        const { config } = renderEditor();
        const row = property('width');
        const input = within(row).getByRole('textbox', { name: 'Width' });
        expect(within(row).queryByText('px')).toBeNull();

        input.focus();
        fireEvent.change(input, { target: { value: 'calc(100% - 1.50rem)' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(config.getInvariants().getProp('value')?.getValue()).toBe('calc(100% - 1.50rem)');
    });

    it('leaves a text story argument on Enter and keeps the typed value', () => {
        renderEditor();
        const text = within(section('Предпросмотр')).getByRole('textbox', { name: 'Text' });

        text.focus();
        fireEvent.change(text, { target: { value: 'Hello' } });
        fireEvent.keyDown(text, { key: 'Enter' });

        expect(text).not.toHaveFocus();
        expect(text).toHaveValue('Hello');
    });

    it('switches a flag on and off with its argument and style properties', () => {
        renderEditor();
        showEmptyRows();

        fireEvent.click(screen.getByRole('switch', { name: 'Pilled' }));
        expect(previewArgs()).toEqual({ size: 's-m', view: 'v-default', pilled: 'p-true' });
        expect(
            property('pilledBorderRadius').querySelector('[data-tooltip="Pilled border radius · pilled: true"]'),
        ).not.toBeNull();

        fireEvent.click(screen.getByRole('switch', { name: 'Pilled' }));
        expect(previewArgs()).toEqual({ size: 's-m', view: 'v-default' });
        expect(
            property('pilledBorderRadius').querySelector('[data-tooltip="Pilled border radius · Инвариант"]'),
        ).not.toBeNull();
    });

    it('writes a colour token into the source style only', () => {
        const { config, onConfigUpdate } = renderEditor();

        fireEvent.change(screen.getByRole('combobox', { name: 'View' }), { target: { value: 'v-default' } });
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

        fireEvent.change(screen.getByRole('combobox', { name: 'Size' }), { target: { value: 's-m' } });
        const height = screen.getByRole('textbox', { name: 'Height' });
        height.focus();
        fireEvent.change(height, { target: { value: '44' } });
        fireEvent.keyDown(height, { key: 'Enter' });

        expect(config.getStyleByVariation('v-size', 's-m')?.getProps().getProp('height')?.getValue()).toBe('44');
        expect(config.getStyleByVariation('v-size', 's-xs')?.getProps().getProp('height')).toBeUndefined();
    });

    it('shows unset properties as empty rows, fills and clears them', () => {
        const { config } = renderEditor();
        showEmptyRows();
        const focus = () => config.getInvariants().getProp('focus');

        // Дополнительной группы «Цвет» нет: цвета живут в секции «Цвет».
        expect(screen.getAllByRole('region', { name: 'Цвет' })).toHaveLength(1);
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

        // Иконки в своей секции, развёрнутой по умолчанию: поля видны без раскрытия группы.
        expect(screen.getByRole('region', { name: 'Иконки' })).toBeInTheDocument();
        expect(screen.queryByRole('region', { name: 'Поведение' })).not.toBeInTheDocument();

        // Каталога в тесте нет: пикер показывает значение строкой, как до выбора из каталога.
        expect(within(property('closeIcon')).getByText('close.16')).not.toBeNull();
        expect(within(property('closeIcon')).queryByRole('button', { name: /Очистить значение/ })).toBeNull();
        expect(within(property('closeIcon')).getByRole('button', { name: /Очистить/ })).not.toBeNull();
    });

    it('hides unset rows by default and shows them with the group filter', () => {
        renderEditor();

        const color = section('Цвет');
        const filter = within(color).getByRole('button', { name: 'Фильтр Цвет' });
        expect(filter).toHaveAttribute('aria-pressed', 'true');
        expect(property('focusColor')).toBeNull();
        expect(property('disabledOpacity')).not.toBeNull();

        fireEvent.click(filter);
        expect(property('focusColor')).not.toBeNull();
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
