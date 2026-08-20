import { getRestoredColorFromPalette } from '@salutejs/plasma-tokens-utils';

import { Config, Theme, ComponentAPI, ComponentVariation, PropType, PropState, PropUnion } from '../../../../controllers';

import { ListItemPreviewWrapper, ListItemColorPreview, ListItemTypographyPreview, ListItemShapePreview, ListItemShadowPreview } from './ComponentEditorProperties.styles';

export const getPropsByVariation = (api: ComponentAPI[], variations: ComponentVariation[], variationID?: string) => {
    if (!variationID) {
        return api.filter((item) => !item.variations || item.variations.length === 0);
    }

    const id = variations.find((variation) => variation.id === variationID)?.id || '';

    return api.filter((item) => item.variations?.find((item) => item === id));
};

// TODO: пока выводит все токены
export const getAllowedProps = (
    config?: Config,
    api?: ComponentAPI[],
    variations?: ComponentVariation[],
    variationID?: string,
    styleID?: string,
) => {
    if (!config || !api || !variations) {
        return [];
    }

    const props = getPropsByVariation(api, variations, variationID);

    return props
        .filter((item) => {
            const isVariationToken = variationID && styleID;

            const props = isVariationToken
                ? config.getStyleByVariation(variationID, styleID)?.getProps()
                : config.getInvariants();
            const prop = props?.getProp(item.id);

            return !prop;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
};

// TODO: хранить это в бд?
export const propTypeMap: Record<string, string> = {
    typography: 'Типографика',
    color: 'Цвет',
    shape: 'Форма',
    shadow: 'Тень',
    float: 'Число',
    dimension: 'Размер',
};

export const getPropList = (
    config: Config,
    api: ComponentAPI[],
    variations: ComponentVariation[],
    selectedVariation?: string,
    selectedStyle?: string,
) => {
    const allProps = getPropsByVariation(api, variations, selectedVariation);

    const groupingProps = (props: PropUnion[]) => {
        const result = {} as Record<PropType, PropUnion[]>;

        allProps.forEach(({ type }) => {
            if (!result[type]) {
                result[type] = [];
            }
        });

        props.forEach((item) => {
            const type = item.getType();

            if (!type) {
                return;
            }

            result[type].push(item);
        });

        return Object.entries(result).map(([key, props]) => ({
            type: propTypeMap[key],
            props,
        }));
    };

    if (selectedVariation === undefined) {
        return groupingProps(config.getInvariants().getList());
    }

    if (!selectedStyle) {
        return [];
    }

    const style = config.getStyleByVariation(selectedVariation, selectedStyle);

    if (!style) {
        return [];
    }

    return groupingProps(style.getProps().getList());
};

export const getColorsTokens = (theme?: Theme) => {
    if (!theme) {
        return [];
    }

    // TODO: подумать, может есть смысл передавать для каждого типа отдельным пропсом
    const colors = theme.getTokens('color');

    const items = colors
        .filter(
            (item) =>
                item.getEnabled() &&
                item.getTags()[0] === 'dark' &&
                !item.getName().includes('hover') &&
                !item.getName().includes('active') &&
                !item.getName().includes('brightness'),
        )
        .map((item) => {
            // TODO: вероятно временное решение
            const [, ...name] = item.getName().split('.');
            const darkValue = item.getValue('web');
            const lightValue = theme.getTokenValue(['light', ...name].join('.'), 'color', 'web') || darkValue;

            return {
                label: name.join('.'),
                value: name.join('.'),
                contentRight: (
                    <ListItemPreviewWrapper>
                        <ListItemColorPreview color={getRestoredColorFromPalette(darkValue)} />
                        <ListItemColorPreview color={getRestoredColorFromPalette(lightValue)} />
                    </ListItemPreviewWrapper>
                ),
            };
        });

    return items;
};

// Состояния, которые можно настроить у color-пропса, и суффикс производного токена темы.
export const colorStates: { state: PropState; label: string; suffix: string }[] = [
    { state: 'hovered', label: 'Hover', suffix: '-hover' },
    { state: 'pressed', label: 'Active', suffix: '-active' },
];

export const getColorStateTokens = (suffix: string, theme?: Theme) => {
    if (!theme) {
        return [];
    }

    const colors = theme.getTokens('color');

    return colors
        .filter(
            (item) =>
                item.getEnabled() &&
                item.getTags()[0] === 'dark' &&
                !item.getName().includes('hover') &&
                !item.getName().includes('active') &&
                !item.getName().includes('brightness'),
        )
        .map((item) => {
            const [, ...name] = item.getName().split('.');
            const baseName = name.join('.');
            const stateName = `${baseName}${suffix}`;

            const darkValue = theme.getTokenValue(['dark', stateName].join('.'), 'color', 'web') || item.getValue('web');
            const lightValue = theme.getTokenValue(['light', stateName].join('.'), 'color', 'web') || darkValue;

            return {
                label: baseName,
                value: stateName,
                contentRight: (
                    <ListItemPreviewWrapper>
                        <ListItemColorPreview color={getRestoredColorFromPalette(darkValue)} />
                        <ListItemColorPreview color={getRestoredColorFromPalette(lightValue)} />
                    </ListItemPreviewWrapper>
                ),
            };
        });
};

export const getShapesTokens = (theme?: Theme) => {
    if (!theme) {
        return [];
    }

    const shapes = theme.getTokens('shape') || [];

    const items = shapes
        .filter((item) => item.getEnabled() && item.getTags()[0] === 'round')
        .map((item) => ({
            label: item.getName(),
            value: item.getName(),
            contentRight: (
                <ListItemPreviewWrapper>
                    <ListItemShapePreview>{parseFloat(item.getValue('web')) * 16}</ListItemShapePreview>
                </ListItemPreviewWrapper>
            ),
        }));

    return items;
};

export const getShadowsTokens = (theme?: Theme) => {
    if (!theme) {
        return [];
    }

    const shadows = theme.getTokens('shadow') || [];

    const items = shadows
        .filter((item) => item.getEnabled())
        .map((item) => {
            const name = item.getName();
            const value = item.getValue('web');
            const boxShadow = Array.isArray(value) ? value.join(', ') : value;

            return {
                label: name,
                value: name,
                contentRight: (
                    <ListItemPreviewWrapper>
                        <ListItemShadowPreview shadow={boxShadow} />
                    </ListItemPreviewWrapper>
                ),
            };
        });

    return items;
};

export const getTypographyTokens = (theme?: Theme) => {
    if (!theme) {
        return [];
    }

    const typography = theme.getTokens('typography');

    const items = typography
        .filter((item) => item.getEnabled() && item.getTags()[0] === 'screen-s')
        .map((item) => {
            // TODO: вероятно временное решение
            const [, ...value] = item.getName().split('.');
            const screenS = item.getValue('web');
            const screenM = theme.getTokenValue(['screen-m', ...value].join('.'), 'typography', 'web') || screenS;
            const screenL = theme.getTokenValue(['screen-l', ...value].join('.'), 'typography', 'web') || screenS;

            return {
                label: value.join('.'),
                value: value.join('.'),
                contentRight: (
                    <ListItemPreviewWrapper>
                        <ListItemTypographyPreview>{parseFloat(screenS.fontSize) * 16}</ListItemTypographyPreview>
                        <ListItemTypographyPreview>{parseFloat(screenM.fontSize) * 16}</ListItemTypographyPreview>
                        <ListItemTypographyPreview>{parseFloat(screenL.fontSize) * 16}</ListItemTypographyPreview>
                    </ListItemPreviewWrapper>
                ),
            };
        });

    return items;
};

export interface PropMenuItem {
    label: string;
    value: string;
    disabled: boolean;
}

export const propMenuList: PropMenuItem[] = [
    {
        label: 'Корректировка',
        value: 'set_adjustment',
        disabled: true,
    },
    {
        label: 'Сбросить',
        value: 'reset_prop',
        disabled: false,
    },
    {
        label: 'Удалить',
        value: 'delete_prop',
        disabled: false,
    },
];

// Префиксы пунктов меню для работы с состояниями; полное значение — `<action>:<PropState>`.
export const ADD_STATE_ACTION = 'add_state';
export const REMOVE_STATE_ACTION = 'remove_state';

export const getPropMenuList = (prop: PropUnion): PropMenuItem[] => {
    if (prop.getType() !== 'color') {
        return propMenuList;
    }

    const states = prop.getStates() ?? [];
    const hasBaseValue = typeof prop.getValue() === 'string' && prop.getValue() !== '';

    const stateItems = colorStates.map(({ state, label }) => {
        const hasState = states.some((item) => item.state[0] === state);

        return hasState
            ? { label: `Удалить ${label}`, value: `${REMOVE_STATE_ACTION}:${state}`, disabled: false }
            : { label: `Добавить ${label}`, value: `${ADD_STATE_ACTION}:${state}`, disabled: !hasBaseValue };
    });

    return [...propMenuList, ...stateItems];
};
