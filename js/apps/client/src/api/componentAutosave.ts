import type { ComponentConfig, PropConfig } from '../controllers';

export interface PropertyChange {
    kind: 'property';
    action: 'upsert' | 'delete';
    propertyId: string;
    variationId?: string;
    styleId?: string;
    stateNames: string[];
    value?: string | number;
    adjustment?: string | number;
}

export interface DefaultChange {
    kind: 'default';
    variationId: string;
    styleId: string | null;
}

export interface StyleChange {
    kind: 'style';
    action: 'create' | 'delete';
    variationId: string;
    styleId: string;
    name?: string;
}

export type ComponentChange = PropertyChange | DefaultChange | StyleChange;

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const propertyKey = (variationId: string | undefined, styleId: string | undefined, propertyId: string, states: string[]) =>
    [variationId || 'invariant', styleId || '-', propertyId, [...states].sort().join('+')].join(':');

const flattenProperties = (config: ComponentConfig) => {
    const values = new Map<string, Omit<PropertyChange, 'kind' | 'action'>>();
    const add = (property: PropConfig, variationId?: string, styleId?: string) => {
        const base = {
            propertyId: property.id,
            variationId,
            styleId,
            stateNames: [] as string[],
            value: property.value,
            adjustment: property.adjustment,
        };
        values.set(propertyKey(variationId, styleId, property.id, []), base);
        property.states?.forEach((state) => {
            const stateNames = [...state.state].sort();
            values.set(propertyKey(variationId, styleId, property.id, stateNames), {
                propertyId: property.id,
                variationId,
                styleId,
                stateNames,
                value: state.value,
            });
        });
    };
    config.invariantProps.forEach((property) => add(property));
    config.variations.forEach((variation) =>
        variation.styles?.forEach((style) => style.props?.forEach((property) => add(property, variation.id, style.id))),
    );
    return values;
};

/** Возвращает только намеренно изменённые предметные строки текущего редактора. */
export const componentChanges = (before: ComponentConfig, after: ComponentConfig): ComponentChange[] => {
    const changes: ComponentChange[] = [];
    const activeStyleIds = new Set(after.variations.flatMap((variation) => variation.styles?.map((style) => style.id) || []));
    const beforeDefaults = new Map(before.defaultVariations.map((item) => [item.variationID, item.styleID]));
    const afterDefaults = new Map(after.defaultVariations.map((item) => [item.variationID, item.styleID]));
    new Set([...beforeDefaults.keys(), ...afterDefaults.keys()]).forEach((variationId) => {
        const previous = beforeDefaults.get(variationId) || null;
        const selected = afterDefaults.get(variationId) || null;
        const current = selected && activeStyleIds.has(selected) ? selected : null;
        if (previous !== current) changes.push({ kind: 'default', variationId, styleId: current });
    });

    const styles = (config: ComponentConfig) =>
        new Map(
            config.variations.flatMap((variation) =>
                (variation.styles || []).map((style) => [style.id, { variationId: variation.id, name: style.name }]),
            ),
        );
    const beforeStyles = styles(before);
    const afterStyles = styles(after);
    afterStyles.forEach((style, styleId) => {
        if (!beforeStyles.has(styleId)) {
            changes.push({ kind: 'style', action: 'create', styleId, ...style });
        }
    });

    const previousProperties = flattenProperties(before);
    const currentProperties = flattenProperties(after);
    new Set([...previousProperties.keys(), ...currentProperties.keys()]).forEach((key) => {
        const previous = previousProperties.get(key);
        const current = currentProperties.get(key);
        if (current && !same(previous, current) && (current.value !== undefined || current.adjustment !== undefined)) {
            changes.push({ kind: 'property', action: 'upsert', ...current });
        } else if (previous && !current && (previous.value !== undefined || previous.adjustment !== undefined)) {
            changes.push({ kind: 'property', action: 'delete', ...previous });
        }
    });

    beforeStyles.forEach((style, styleId) => {
        if (!afterStyles.has(styleId)) {
            changes.push({ kind: 'style', action: 'delete', styleId, variationId: style.variationId });
        }
    });
    return changes;
};
