import { Config } from '../../../../controllers';

export const isDefaultStyle = (config: Config, variationID: string, styleID: string) =>
    Boolean(
        config.getDefaults().find((item) => item.getVariationID() === variationID && item.getStyleID() === styleID),
    );

export const getVariations = (config: Config) => {
    const variations = config.getVariations().map((variation) => {
        const propValues = (variation.getStyles() || [])
            .map((style) => ({
                label: style.getName(),
                value: style.getID(),
                isDefault: isDefaultStyle(config, variation.getID(), style.getID()),
            }))
            .sort((a, b) => a.label.localeCompare(b.label));

        return {
            label: variation.getName(),
            value: variation.getID(),
            inner: propValues,
        };
    });
    variations.push({
        label: 'invariants',
        value: 'invariants',
        inner: [],
    });

    return variations;
};

export const variationMap: Record<string, string> = {
    view: 'Вид',
    size: 'Размер',
    shape: 'Форма',
    invariants: 'Состояния',
};

export type StyleMenuItem = {
    label: string;
    value: 'set_style_default' | 'unset_style_default' | 'delete_style';
    disabled: boolean;
};

export const getStyleMenuList = (isDefault: boolean): StyleMenuItem[] => [
    isDefault
        ? { label: 'Снять по умолчанию', value: 'unset_style_default', disabled: false }
        : { label: 'Установить по умолчанию', value: 'set_style_default', disabled: false },
    { label: 'Удалить', value: 'delete_style', disabled: false },
];
