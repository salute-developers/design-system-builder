import { Config } from '../../../../controllers';

export const isDefaultStyle = (config: Config, variationID: string, styleID: string) =>
    Boolean(
        config.getDefaults().find((item) => item.getVariationID() === variationID && item.getStyleID() === styleID),
    );

export const getVariations = (config: Config) => {
    const variations = config.getVariations().map((variation) => {
        const propValues = (variation.getStyles() || []).map((style) => ({
            label: style.getName(),
            value: style.getID(),
            isDefault: isDefaultStyle(config, variation.getID(), style.getID()),
        }));

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

// TODO: хранить это в бд
export const variationMap: Record<string, string> = {
    view: 'Вид',
    size: 'Размер',
    shape: 'Форма',
    invariants: 'Состояния',
};

export const styleMenuList = [
    {
        label: 'Установить по умолчанию',
        value: 'set_style_default',
        disabled: false,
    },
    {
        label: 'Сбросить',
        value: 'reset_style',
        disabled: true,
    },
    {
        label: 'Удалить',
        value: 'delete_style',
        disabled: false,
    },
] as const;

export type StyleMenuItem = (typeof styleMenuList)[number];
