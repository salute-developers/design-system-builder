import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Config, DesignSystem, type Meta } from '../../../../controllers';
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
) => {
    const group: Meta = { ...groupMeta(), platform };
    const button: Meta = { ...buttonMeta(), platform: 'compose' };
    const config = new Config(group);
    const prop = config.getStyleByVariation('size', 'group-xxs')!.getProps().getProp('buttonStyle')!;
    const designSystem = DesignSystem.fromSnapshot({
        name: 'ds',
        componentsData: platform === 'web' ? [group] : [],
        composeComponentsData: platform === 'compose' ? [group, button] : [button],
    });
    return render(
        <StyleReferenceContext.Provider value={{ designSystem }}>
            <InspectorPropertyRow
                config={config}
                api={group.sources.api}
                prop={prop}
                source={rowSource}
                isSet
                tokens={tokens}
                onConfigUpdate={vi.fn()}
            />
        </StyleReferenceContext.Provider>,
    );
};

describe('InspectorPropertyRow: ссылка на стиль', () => {
    afterEach(cleanup);

    it('у Compose рисует выбор стиля и даёт очистить значение', () => {
        renderRow('compose');

        expect(screen.getByTestId('style-reference')).toBeTruthy();
        expect(screen.getByRole('button', { name: /Очистить значение/ })).toBeTruthy();
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
});
