import { describe, expect, it } from 'vitest';
import type { ComponentAPI, PropType } from '../type';
import { Props } from './props';

const mappings = { xml: null, compose: 'buttonHeight', ios: null, web: null };
const apiProperty = (type: PropType, id = 'height'): ComponentAPI => ({
    id,
    name: 'Height',
    type,
    variations: null,
    platformMappings: mappings,
});

describe('Core property construction', () => {
    it.each<PropType>([
        'color',
        'dimension',
        'float',
        'integer',
        'icon',
        'shadow',
        'shape',
        'typography',
        'value',
        'component_style',
    ])('preserves saved %s values and platform mappings', (type) => {
        const props = new Props([{ id: 'height', value: 24, adjustment: 2 }], [apiProperty(type)]);
        const property = props.getProp('height');
        expect(property?.getType()).toBe(type);
        expect(property?.getName()).toBe('Height');
        expect(property?.getValue()).toBe(24);
        expect(property?.getAdjustment()).toBe(2);
        expect(property?.getPlatformMappings()).toEqual(mappings);
    });

    it.each(['unsupported', 'constructor', 'toString'])(
        'ignores unsupported type %s on import and addition',
        (type) => {
            const api = [apiProperty(type as PropType)];
            const props = new Props([{ id: 'height', value: 24 }], api);
            props.addProp('height', 32, api);
            expect(props.getList()).toEqual([]);
        },
    );

    it('accepts an absent property collection from an older configuration', () => {
        const props = new Props(undefined, [apiProperty('dimension')]);
        expect(props.getList()).toEqual([]);
        props.addProp('height', 32, [apiProperty('dimension')]);
        expect(props.getProp('height')?.getValue()).toBe(32);
    });

    it('uses the same property model for newly assigned values', () => {
        const props = new Props(null, []);
        props.addProp('height', 32, [apiProperty('dimension')]);
        expect(props.getProp('height')?.getType()).toBe('dimension');
        expect(props.getProp('height')?.getValue()).toBe(32);
        expect(props.getProp('height')?.getPlatformMappings()).toEqual(mappings);
    });
});
