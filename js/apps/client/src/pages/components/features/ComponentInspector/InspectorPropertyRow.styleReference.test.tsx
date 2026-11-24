import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Config, DesignSystem, type Meta, type StateSupport } from '../../../../controllers';
import { buttonMeta, groupMeta } from '../../../../composePreview/nestedStyleFixture';

import { InspectorPropertyRow, type InspectorTokenLists } from './InspectorPropertyRow';
import { StyleReferenceContext } from './StyleReferenceContext';

const tokens: InspectorTokenLists = {
    colors: [],
    shapes: [],
    shadows: [],
    typography: [],
    resolveColor: () => undefined,
};
const source = {
    kind: 'style',
    variationID: 'size',
    variationName: 'size',
    styleID: 'group-xxs',
    styleName: 'xxs',
} as const;

const renderRow = (
    platform: 'compose' | 'web',
    rowSource: Parameters<typeof InspectorPropertyRow>[0]['source'] = source,
    support?: StateSupport,
    ownState = false,
) => {
    const group: Meta = { ...groupMeta(), platform };
    const button: Meta = { ...buttonMeta(), platform: 'compose' };
    group.sources.api[0].stateSupport = support;
    button.sources.configs[0].config.variations[0].styles!.push({
        id: 'size-xs',
        name: 'xs',
        intersections: null,
        props: [],
    });
    if (ownState && rowSource.kind === 'combination') {
        group.sources.configs[0].config.combinations = [
            {
                styleIDs: rowSource.styleIDs,
                props: [
                    {
                        id: 'buttonStyle',
                        states: [{ state: ['pressed'], value: 'basic-button.xxs.default' }],
                    },
                ],
            },
        ];
    }
    const config = new Config(group);
    const prop = ownState
        ? config.getCombinations()[0].props.getProp('buttonStyle')!
        : config.getStyleByVariation('size', 'group-xxs')!.getProps().getProp('buttonStyle')!;
    const designSystem = DesignSystem.fromSnapshot({
        name: 'ds',
        componentsData: platform === 'web' ? [group] : [],
        composeComponentsData: platform === 'compose' ? [group, button] : [button],
    });
    const onCombinationChange = vi.fn();
    const ui = () => (
        <StyleReferenceContext.Provider value={{ designSystem }}>
            <InspectorPropertyRow
                config={config}
                api={group.sources.api}
                prop={prop}
                source={rowSource}
                isSet
                tokens={tokens}
                onConfigUpdate={vi.fn()}
                onCombinationChange={onCombinationChange}
            />
        </StyleReferenceContext.Provider>
    );
    const view = render(ui());
    return { ...view, refresh: () => view.rerender(ui()), prop, onCombinationChange };
};

describe('InspectorPropertyRow: ссылка на стиль', () => {
    afterEach(cleanup);

    it('у Compose рисует выбор стиля и даёт очистить значение', () => {
        renderRow('compose');

        expect(screen.getByTestId('style-reference')).toBeTruthy();
        expect(screen.getByRole('button', { name: /Очистить значение/ })).toBeTruthy();
    });

    it('добавляет состояние ссылки, меняет стиль в нём и разрешает удалить состояние после смены меты', () => {
        const support = { states: ['pressed'], combinations: false };
        const { prop, refresh } = renderRow('compose', source, support);

        fireEvent.click(screen.getByRole('button', { name: 'Добавить состояние: Button style' }));
        fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'pressed' }));
        fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));
        refresh();
        expect(prop.getStates()).toEqual([{ state: ['pressed'], value: 'basic-button.xxs.default' }]);

        fireEvent.click(screen.getByRole('button', { name: 'Button style pressed: size' }));
        fireEvent.click(screen.getByRole('option', { name: 'xs' }));
        refresh();
        expect(prop.getStates()?.[0].value).toBe('basic-button.xs.default');
        expect(prop.getValue()).toBe('basic-button.xxs.default');

        support.states = [];
        refresh();
        expect(screen.queryByRole('button', { name: /Добавить состояние/ })).toBeNull();
        expect(screen.getByRole('button', { name: 'Button style pressed: size' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Удалить состояние: Button style pressed' }));
        refresh();
        expect(screen.queryByRole('button', { name: 'Button style pressed: size' })).toBeNull();
        expect(prop.getStates()).toBeNull();
    });

    it('выносит строки стилей вариаций на уровень строки свойства, а не в ячейку значения', () => {
        const { container } = renderRow('compose');

        const group = container.querySelector('.component-variation-property-group-row')!;
        const rows = [...group.querySelectorAll(':scope > .component-variation-state-row.is-style-reference')];
        expect(rows.map((row) => row.querySelector('span')?.textContent)).toEqual(['size', 'view']);
        expect(group.querySelector('.component-variation-property-value .component-variation-state-row')).toBeNull();
    });

    it('у сочетания вариаций оставляет поле только для чтения: ссылка пишется только у стилей и инвариантов', () => {
        renderRow('compose', { kind: 'combination', styleIDs: ['group-xxs'], label: 'size: xxs' });

        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.readOnly).toBe(true);
        expect(input.value).toBe('basic-button.xxs.default');
        expect(screen.queryByTestId('style-reference')).toBeNull();
        expect(screen.queryByRole('button', { name: /Очистить значение/ })).toBeNull();
    });

    it('у других платформ оставляет поле только для чтения без очистки', () => {
        renderRow('web');

        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.readOnly).toBe(true);
        expect(input.value).toBe('basic-button.xxs.default');
        expect(screen.queryByTestId('style-reference')).toBeNull();
        expect(screen.queryByRole('button', { name: /Очистить значение/ })).toBeNull();
    });
    it('переопределяет вложенный стиль в унаследованном состоянии пересечения', () => {
        const { prop, refresh, onCombinationChange } = renderRow(
            'compose',
            {
                kind: 'combination',
                styleIDs: ['group-xxs', 'unused-view'],
                label: 'size: xxs · view: default',
            },
            { states: ['pressed'], combinations: true },
        );
        prop.addState({ state: ['pressed'], value: 'basic-button.xxs.default' });
        refresh();
        fireEvent.click(screen.getByRole('button', { name: 'Button style pressed: size' }));
        fireEvent.click(screen.getByRole('option', { name: 'xs' }));
        expect(onCombinationChange).toHaveBeenCalledWith(
            'buttonStyle',
            'basic-button.xs.default',
            ['pressed'],
            undefined,
        );
        expect(prop.getValue()).toBe('basic-button.xxs.default');
        expect(prop.getStates()?.[0].value).toBe('basic-button.xxs.default');
        expect(screen.queryByRole('button', { name: 'Удалить состояние: Button style pressed' })).toBeNull();
    });
    it('правит и удаляет собственную ссылку состояния пересечения, прежнюю недопустимую показывает отключённой', () => {
        const support = { states: ['pressed'], combinations: true };
        const { refresh, onCombinationChange } = renderRow(
            'compose',
            {
                kind: 'combination',
                styleIDs: ['group-xxs', 'view-default'],
                label: 'size: xxs · view: default',
            },
            support,
            true,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Button style pressed: size' }));
        fireEvent.click(screen.getByRole('option', { name: 'xs' }));
        expect(onCombinationChange).toHaveBeenCalledWith(
            'buttonStyle',
            'basic-button.xs.default',
            ['pressed'],
            undefined,
        );
        support.states = [];
        refresh();
        expect(screen.getByRole('button', { name: 'Button style pressed: size' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Удалить состояние: Button style pressed' }));
        expect(onCombinationChange).toHaveBeenCalledWith('buttonStyle', null, ['pressed']);
    });
});
