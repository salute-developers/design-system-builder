import { describe, expect, it } from 'vitest';
import { Config, resolveSelectedProps } from './index';
import { chipMeta } from '../../pages/components/features/__fixtures__/chipMeta';
import type { Meta } from './type';

describe('состояния пересечения', () => {
    it('наследует базовое значение и состояния независимо, не меняя исходный стиль', () => {
        const meta = structuredClone(chipMeta) as Meta;
        const config = meta.sources.configs[0].config;
        const base = config.variations.find((x) => x.id === 'v-size')!.styles!.find((x) => x.id === 's-m')!;
        base.props!.find((x) => x.id === 'height')!.states = [{ state: ['pressed'], value: '31' }];
        config.combinations = [
            {
                styleIDs: ['s-m', 'v-default'],
                props: [{ id: 'height', states: [{ state: ['hovered'], value: '55' }] }],
            },
        ];
        const model = new Config(meta);
        const own = model.getCombinations()[0].props.getProp('height')!;
        const original = model.getStyleByVariation('v-size', 's-m')!.getProps().getProp('height')!;
        const prop = resolveSelectedProps(model, ['s-m', 'v-default']).get('height')!.prop;
        expect(prop.getValue()).toBe(original.getValue());
        expect(prop.getStates()).toEqual([
            { state: ['pressed'], value: '31' },
            { state: ['hovered'], value: '55' },
        ]);
        expect(original.getStates()).toEqual([{ state: ['pressed'], value: '31' }]);
        own.setValue('60');
        expect(resolveSelectedProps(model, ['s-m', 'v-default']).get('height')!.prop.getValue()).toBe('60');
        expect(resolveSelectedProps(model, ['s-m']).get('height')!.prop.getStates()).toEqual(original.getStates());
    });
});
