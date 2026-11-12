import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Config, type Meta } from '../../../../controllers';
import type { EditorAxisDto } from '../../../../api/editorContracts';
import { chipMeta } from '../__fixtures__/chipMeta';

const repository = vi.hoisted(() => ({
    loadModel: vi.fn(),
    createConfiguration: vi.fn(async () => ({ id: 'created' })),
    duplicateConfiguration: vi.fn(async () => ({ id: 'duplicated' })),
    renameConfiguration: vi.fn(async () => undefined),
    deleteConfiguration: vi.fn(async () => undefined),
    addAxis: vi.fn(async () => undefined),
    deleteAxis: vi.fn(async () => undefined),
    reorderAxes: vi.fn(async () => undefined),
    renameAxis: vi.fn(async () => undefined),
    setDefaultValue: vi.fn(async () => undefined),
    addValue: vi.fn(async () => undefined),
    renameValue: vi.fn(async () => undefined),
    deleteValue: vi.fn(async () => undefined),
    removeCombination: vi.fn(async () => undefined),
}));
vi.mock('../../../../api/componentStructureRepository', () => ({ componentStructureRepository: repository }));

import { ComponentStructurePanel } from './ComponentStructurePanel';

const context = { projectId: 'project', designSystemId: 'ds', tenantId: 'tenant' };

const value = (styleId: string, name: string, position: number) => ({
    id: `value-${styleId}`,
    styleId,
    name,
    displayName: null,
    position,
    revision: 1,
});
const axis = (id: string, name: string, position: number, extra: Partial<EditorAxisDto> = {}): EditorAxisDto => ({
    id: `axis-${id}`,
    variationId: id,
    name,
    displayName: null,
    position,
    isColorScheme: false,
    locked: false,
    defaultStyleId: null,
    revision: 1,
    values: [],
    ...extra,
});
const axes: EditorAxisDto[] = [
    axis('size', 'size', 0, { defaultStyleId: 's-m', values: [value('s-xs', 'xs', 0), value('s-m', 'm', 1)] }),
    axis('view', 'view', 1, {
        isColorScheme: true,
        locked: true,
        defaultStyleId: 'v-default',
        values: [value('v-default', 'default', 0), value('v-accent', 'accent', 1)],
    }),
    axis('pilled', 'pilled', 2, { values: [value('p-true', 'true', 0)] }),
];

const meta = {
    ...chipMeta,
    serverBinding: { componentId: 'chip', appearanceId: 'base' },
    sources: {
        ...chipMeta.sources,
        configs: [
            {
                ...chipMeta.sources.configs[0],
                id: 'base',
                name: 'Chip',
                isDefault: true,
                config: {
                    ...chipMeta.sources.configs[0].config,
                    combinations: [{ styleIDs: ['s-m', 'p-true'], props: [{ id: 'height', value: '44' }] }],
                },
            },
            { ...chipMeta.sources.configs[0], id: 'copy', name: 'Chip copy' },
        ],
    },
} as unknown as Meta;

const renderPanel = (configurationId?: string) => {
    const run = vi.fn(async (operation: (value: typeof context) => Promise<string | void>) => {
        await operation(context);
    });
    const onSelectionChange = vi.fn();
    const onConfigurationSelect = vi.fn();
    const onCombinationSelect = vi.fn();
    const structure = { context, run };
    const panel = (id?: string) => (
        <ComponentStructurePanel
            config={id ? new Config(meta).withConfiguration(id) : new Config(meta)}
            structure={structure}
            selection={{ size: 's-m', view: 'v-default' }}
            onSelectionChange={onSelectionChange}
            onConfigurationSelect={onConfigurationSelect}
            onCombinationSelect={onCombinationSelect}
        />
    );
    const { rerender } = render(panel(configurationId));
    return {
        run,
        onSelectionChange,
        onConfigurationSelect,
        onCombinationSelect,
        open: (id?: string) => rerender(panel(id)),
    };
};

describe('ComponentStructurePanel', () => {
    beforeEach(() => {
        Object.values(repository).forEach((mock) => mock.mockClear());
        repository.loadModel.mockResolvedValue({ appearance: {}, revision: 1, axes });
    });
    afterEach(cleanup);

    it('lists configurations with the protected default and opens another one', async () => {
        const { onConfigurationSelect } = renderPanel();
        const configurations = screen.getByRole('region', { name: 'Конфигурации' });

        expect(within(configurations).getByRole('button', { name: 'Chip' })).toHaveAttribute('aria-pressed', 'true');
        expect(
            within(configurations).getByRole('button', { name: 'Нельзя удалить базовую конфигурацию', hidden: true }),
        ).toBeDisabled();
        fireEvent.click(within(configurations).getByRole('button', { name: 'Chip copy' }));
        expect(onConfigurationSelect).toHaveBeenCalledWith('copy');
    });

    it('creates and duplicates configurations through the editor API', async () => {
        const { run } = renderPanel();

        fireEvent.click(screen.getByRole('button', { name: 'Добавить конфигурацию' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Создать новый' }));
        await waitFor(() => expect(repository.createConfiguration).toHaveBeenCalledWith(context, 'chip'));

        fireEvent.click(screen.getByRole('button', { name: 'Добавить конфигурацию' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Дублировать «Chip copy»' }));
        await waitFor(() => expect(repository.duplicateConfiguration).toHaveBeenCalledWith(context, 'copy'));
        expect(run).toHaveBeenCalledTimes(2);
    });

    it('shows the colour scheme variation first, protected, and selects values for the preview', async () => {
        const { onSelectionChange } = renderPanel();
        const view = await screen.findByRole('region', { name: 'Вариация view' });
        const groups = screen
            .getAllByRole('region', { name: /^Вариация / })
            .map((item) => item.getAttribute('aria-label'));

        expect(groups).toEqual(['Вариация view', 'Вариация size', 'Вариация pilled']);
        expect(
            within(view).getByRole('button', { name: 'Нельзя удалить базовую вариацию', hidden: true }),
        ).toBeDisabled();
        fireEvent.click(within(view).getByRole('button', { name: 'accent' }));
        expect(onSelectionChange).toHaveBeenCalledWith('view', 'v-accent');
    });

    it('asks before deleting a value and deletes it only after confirmation', async () => {
        renderPanel();
        const size = await screen.findByRole('region', { name: 'Вариация size' });

        fireEvent.click(within(size).getByRole('button', { name: 'Удалить xs', hidden: true }));
        fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
        expect(repository.deleteValue).not.toHaveBeenCalled();

        fireEvent.click(within(size).getByRole('button', { name: 'Удалить xs', hidden: true }));
        fireEvent.click(screen.getByRole('button', { name: 'Удалить значение' }));
        await waitFor(() => expect(repository.deleteValue).toHaveBeenCalledWith(context, 'base', 'value-s-xs'));
    });

    it('renames a value in this configuration and sets the default value', async () => {
        renderPanel('copy');
        const size = await screen.findByRole('region', { name: 'Вариация size' });

        fireEvent.click(within(size).getByRole('button', { name: 'Сделать xs значением по умолчанию', hidden: true }));
        await waitFor(() => expect(repository.setDefaultValue).toHaveBeenCalledWith(context, 'axis-size', 's-xs'));

        fireEvent.click(within(size).getByRole('button', { name: 'Переименовать m', hidden: true }));
        const input = within(size).getByRole('textbox', { name: 'Название значения' });
        fireEvent.change(input, { target: { value: 'medium' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() => expect(repository.renameValue).toHaveBeenCalledWith(context, 'value-s-m', 'medium'));
    });

    it('moves a variation with the keyboard and keeps the colour scheme axis in its place', async () => {
        renderPanel();
        await screen.findByRole('region', { name: 'Вариация pilled' });

        fireEvent.keyDown(screen.getByRole('button', { name: /Порядок вариации pilled/ }), { key: 'ArrowUp' });

        await waitFor(() =>
            expect(repository.reorderAxes).toHaveBeenCalledWith(context, 'base', [
                'axis-pilled',
                'axis-view',
                'axis-size',
            ]),
        );
    });

    it('moves a variation by drag and drop, dropping into the gap of the list', async () => {
        renderPanel();
        await screen.findByRole('region', { name: 'Вариация pilled' });
        const dataTransfer = { setData: vi.fn(), effectAllowed: '' };

        fireEvent.dragStart(screen.getByRole('button', { name: /Порядок вариации pilled/ }), { dataTransfer });
        const sizeSlot = screen.getByRole('region', { name: 'Вариация size' }).parentElement!;
        fireEvent.dragOver(sizeSlot, { clientY: -1 });
        expect(screen.getByRole('region', { name: 'Вариация size' })).toHaveClass('is-drop-before');
        fireEvent.drop(screen.getByRole('region', { name: 'Вариации' }));

        expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'axis-pilled');
        await waitFor(() =>
            expect(repository.reorderAxes).toHaveBeenCalledWith(context, 'base', [
                'axis-pilled',
                'axis-view',
                'axis-size',
            ]),
        );
    });

    it('reloads its model after an operation even when the component config stays the same', async () => {
        renderPanel();
        await screen.findByRole('region', { name: 'Вариация pilled' });
        const reordered = [
            { ...axes[2], position: 0 },
            axes[1],
            { ...axes[0], position: 2 },
        ];
        repository.loadModel.mockResolvedValue({ appearance: {}, revision: 2, axes: reordered });

        fireEvent.keyDown(screen.getByRole('button', { name: /Порядок вариации pilled/ }), { key: 'ArrowUp' });

        await waitFor(() => expect(repository.loadModel).toHaveBeenCalledTimes(2));
        await waitFor(() => {
            const names = screen
                .getAllByRole('region', { name: /^Вариация / })
                .map((region) => region.getAttribute('aria-label'));
            expect(names.indexOf('Вариация pilled')).toBeLessThan(names.indexOf('Вариация size'));
        });
    });

    it('keeps configuration names kebab-case while typing and does not send an invalid one', async () => {
        renderPanel();
        const row = screen.getByRole('button', { name: 'Chip copy' }).closest('.component-configuration-tree-row')!;

        fireEvent.click(
            within(row as HTMLElement).getByRole('button', {
                name: 'Переименовать конфигурацию Chip copy',
                hidden: true,
            }),
        );
        const input = screen.getByRole('textbox', { name: 'Название конфигурации' });
        fireEvent.change(input, { target: { value: 'Dense Mode' } });
        expect(input).toHaveValue('dense-mode');
        fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() => expect(repository.renameConfiguration).toHaveBeenCalledWith(context, 'copy', 'dense-mode'));

        repository.renameConfiguration.mockClear();
        fireEvent.click(
            within(row as HTMLElement).getByRole('button', {
                name: 'Переименовать конфигурацию Chip copy',
                hidden: true,
            }),
        );
        const again = screen.getByRole('textbox', { name: 'Название конфигурации' });
        fireEvent.change(again, { target: { value: '1st' } });
        fireEvent.keyDown(again, { key: 'Enter' });
        expect(await screen.findByRole('alert')).toHaveTextContent('Недопустимое имя конфигурации');
        expect(repository.renameConfiguration).not.toHaveBeenCalled();
    });

    it('adds a variation with the default value', async () => {
        renderPanel();
        await screen.findByRole('region', { name: 'Вариация size' });

        fireEvent.click(screen.getByRole('button', { name: 'Добавить вариацию' }));
        const input = screen.getByRole('textbox', { name: 'Название вариации' });
        fireEvent.change(input, { target: { value: 'density' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        await waitFor(() => expect(repository.addAxis).toHaveBeenCalledWith(context, 'base', 'density'));
    });

    it('показывает дерево вариаций, фильтрует настроенные и открывает пересечение', async () => {
        const { onSelectionChange, onCombinationSelect } = renderPanel();
        const tree = await screen.findByRole('region', { name: 'Дерево вариаций' });
        await within(tree).findByRole('button', { name: 'size: m' });

        fireEvent.click(within(tree).getByRole('button', { name: 'Развернуть ветку size: m' }));
        const intersection = within(tree).getByRole('button', { name: 'size: m · pilled: true' });
        expect(intersection).toHaveClass('is-configured');
        // Уровни идут подряд: цветовая схема только под `pilled`, а не прямо под `size`.
        expect(within(tree).queryByRole('button', { name: 'size: m · view: accent' })).toBeNull();
        fireEvent.click(within(tree).getByRole('button', { name: 'Развернуть ветку size: m · pilled: true' }));
        expect(within(tree).getByRole('button', { name: 'size: m · pilled: true · view: accent' })).not.toHaveClass(
            'is-configured',
        );

        fireEvent.click(intersection);
        expect(onSelectionChange).toHaveBeenCalledWith('size', 's-m');
        expect(onSelectionChange).toHaveBeenCalledWith('pilled', 'p-true');
        expect(onCombinationSelect).toHaveBeenCalledWith(['s-m', 'p-true']);

        fireEvent.click(within(tree).getByRole('button', { name: 'Только настроенные пересечения' }));
        expect(within(tree).queryByRole('button', { name: 'size: xs' })).toBeNull();
        expect(within(tree).queryByRole('button', { name: 'pilled: true' })).toBeNull();
        expect(within(tree).getByRole('button', { name: 'size: m · pilled: true' })).toBeInTheDocument();
    });

    it('удаляет пересечение только после подтверждения', async () => {
        renderPanel();
        const tree = await screen.findByRole('region', { name: 'Дерево вариаций' });
        fireEvent.click(await within(tree).findByRole('button', { name: 'Развернуть ветку size: m' }));

        fireEvent.click(within(tree).getByRole('button', { name: 'Удалить пересечение size: m · pilled: true' }));
        fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
        expect(repository.removeCombination).not.toHaveBeenCalled();

        fireEvent.click(within(tree).getByRole('button', { name: 'Удалить пересечение size: m · pilled: true' }));
        fireEvent.click(screen.getByRole('button', { name: 'Удалить пересечение' }));
        await waitFor(() =>
            expect(repository.removeCombination).toHaveBeenCalledWith(context, 'base', ['s-m', 'p-true']),
        );
    });

    it('hides the variations of the previous configuration while the open one loads', async () => {
        const { open } = renderPanel();
        await screen.findByRole('region', { name: 'Вариация size' });

        let resolve: (value: unknown) => void = () => undefined;
        repository.loadModel.mockReturnValueOnce(new Promise((done) => (resolve = done)));
        open('copy');

        expect(screen.getByRole('status')).toHaveTextContent('Загружаем вариации…');
        expect(screen.queryByRole('region', { name: 'Вариация size' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Добавить вариацию' })).toBeDisabled();

        resolve({ appearance: {}, revision: 1, axes });
        await screen.findByRole('region', { name: 'Вариация size' });
        fireEvent.click(screen.getByRole('button', { name: 'Переименовать вариацию size', hidden: true }));
        const input = screen.getByRole('textbox', { name: 'Название вариации' });
        fireEvent.change(input, { target: { value: 'scale' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() => expect(repository.renameAxis).toHaveBeenCalledWith(context, 'axis-size', 'scale'));
        expect(repository.loadModel).toHaveBeenLastCalledWith(context, 'copy', expect.anything());
    });

    it('lists intersections that skip a level under the tree and opens them', async () => {
        const skipping = {
            ...meta,
            sources: {
                ...meta.sources,
                configs: [
                    {
                        ...meta.sources.configs[0],
                        config: {
                            ...meta.sources.configs[0].config,
                            combinations: [{ styleIDs: ['s-m', 'v-accent'], props: [{ id: 'height', value: '44' }] }],
                        },
                    },
                ],
            },
        } as unknown as Meta;
        const onCombinationSelect = vi.fn();
        render(
            <ComponentStructurePanel
                config={new Config(skipping)}
                structure={{ context, run: vi.fn() }}
                selection={{ size: 's-m', view: 'v-default' }}
                onSelectionChange={vi.fn()}
                onConfigurationSelect={vi.fn()}
                onCombinationSelect={onCombinationSelect}
            />,
        );
        const others = await screen.findByRole('group', { name: 'Другие пересечения' });

        fireEvent.click(within(others).getByRole('button', { name: 'size: m · view: accent' }));
        expect(onCombinationSelect).toHaveBeenCalledWith(['s-m', 'v-accent']);
        fireEvent.click(
            within(others).getByRole('button', { name: 'Удалить пересечение size: m · view: accent', hidden: true }),
        );
        expect(screen.getByRole('alertdialog')).toHaveTextContent('Удалить пересечение?');
    });
});
