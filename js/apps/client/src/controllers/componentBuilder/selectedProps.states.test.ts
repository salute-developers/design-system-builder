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
    it('сохраняет состояния инварианта при собственной базе и показывает источник каждого набора', () => {
        const meta = structuredClone(chipMeta) as Meta;
        const config = meta.sources.configs[0].config;
        config.invariantProps!.push({ id: 'height', value: '20', states: [{ state: ['hovered'], value: '21' }] });
        config.variations.find((x) => x.id === 'v-size')!.styles!.find((x) => x.id === 's-m')!.props = [];
        config.combinations = [
            {
                styleIDs: ['s-m', 'v-default'],
                props: [{ id: 'height', states: [{ state: ['pressed'], value: '55' }] }],
            },
        ];
        const model = new Config(meta);
        const resolve = () => resolveSelectedProps(model, ['s-m', 'v-default']).get('height')!;
        expect(resolve().from.kind).toBe('invariant');
        expect(resolve().prop.getValue()).toBe('20');
        expect(resolve().prop.getStates()).toEqual([
            { state: ['hovered'], value: '21' },
            { state: ['pressed'], value: '55' },
        ]);
        const own = model.getCombinations()[0].props.getProp('height')!;
        own.setValue('60');
        expect(resolve().prop.getValue()).toBe('60');
        expect(resolve().prop.getStates()).toHaveLength(2);
        expect(resolve().stateSources.get('hovered')?.kind).toBe('invariant');
        expect(resolve().stateSources.get('pressed')?.kind).toBe('combination');
        expect(model.getInvariants().getProp('height')!.getValue()).toBe('20');
        own.removeState('pressed');
        expect(resolve().prop.getStates() ?? []).toHaveLength(0);
        expect(resolve().stateSources.size).toBe(0);
    });

    it('наследует состояния инварианта через стиль с состояниями, но база без состояний их скрывает', () => {
        const meta = structuredClone(chipMeta) as Meta;
        const config = meta.sources.configs[0].config;
        config.invariantProps!.push({ id: 'height', value: '20', states: [{ state: ['hovered'], value: '21' }] });
        const style = config.variations.find((x) => x.id === 'v-size')!.styles!.find((x) => x.id === 's-m')!;
        style.props!.find((x) => x.id === 'height')!.states = [{ state: ['pressed'], value: '31' }];
        const model = new Config(meta);
        const resolved = resolveSelectedProps(model, ['s-m']).get('height')!;
        expect(resolved.prop.getStates()).toHaveLength(2);
        expect(resolved.stateSources.get('hovered')?.kind).toBe('invariant');
        expect(resolved.stateSources.get('pressed')?.kind).toBe('style');
        model.getStyleByVariation('v-size', 's-m')!.getProps().getProp('height')!.removeState('pressed');
        expect(resolveSelectedProps(model, ['s-m']).get('height')!.prop.getStates() ?? []).toHaveLength(0);
    });
});
