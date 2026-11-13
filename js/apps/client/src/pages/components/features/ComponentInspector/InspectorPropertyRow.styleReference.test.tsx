import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Config, DesignSystem, type Meta } from '../../../../controllers';
import { buttonMeta, groupMeta } from '../../../../composePreview/nestedStyleFixture';

import { InspectorPropertyRow, type InspectorTokenLists } from './InspectorPropertyRow';
import { StyleReferenceContext } from './StyleReferenceContext';

const tokens: InspectorTokenLists = { colors: [], shapes: [], shadows: [], typography: [], resolveColor: () => undefined };
const source = { kind: 'style', variationID: 'size', variationName: 'size', styleID: 'group-xxs', styleName: 'xxs' } as const;

const renderRow = (platform: 'compose' | 'web') => {
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
                source={source}
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

    it('у других платформ оставляет поле только для чтения без очистки', () => {
        renderRow('web');

        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.readOnly).toBe(true);
        expect(input.value).toBe('basic-button.xxs.default');
        expect(screen.queryByTestId('style-reference')).toBeNull();
        expect(screen.queryByRole('button', { name: /Очистить значение/ })).toBeNull();
    });
});
