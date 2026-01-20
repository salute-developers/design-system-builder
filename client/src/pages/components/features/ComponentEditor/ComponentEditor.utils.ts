import { getRestoredColorFromPalette } from '@salutejs/plasma-tokens-utils';

import { Config, Theme } from '../../../../controllers';

export const createThemeVars = (theme: Theme, themeMode: any) => {
    return theme
        .getTokens('color')
        .filter((item) => item.getEnabled() && item.getTags()[0] === themeMode)
        .reduce((acc, token) => {
            const [, category, subcategory, name] = token.getName().split('.');
            const tokenName = [subcategory === 'default' ? '-' : `--${subcategory}`, category, name].join('-');

            return {
                ...acc,
                [tokenName]: getRestoredColorFromPalette(token.getValue('web')),
            };
        }, {});
};

// TODO: перенести в утилиты?
export const createComponentVars = (
    config: Config,
    theme: Theme,
    args: Record<string, string | boolean>,
    themeMode: any,
) => {
    const variations = config.getVariations();
    const invariants = config.getInvariants();
    const componentName = config.getName();

    const items = Object.entries(args).map(([variation, value]) => ({
        variation,
        value,
    }));

    const variationsVars = items.reduce((vars, obj) => {
        const variation = variations.find((item) => item.getName() === obj.variation);
        const style = variation?.getStyles()?.find((item) => item.getID() === obj.value);

        const props = style
            ?.getProps()
            .getList()
            .reduce(
                (acc, prop) => ({
                    ...acc,
                    ...prop.getWebTokenValue(componentName, theme, themeMode),
                }),
                {},
            );

        return {
            ...vars,
            ...props,
        };
    }, {});

    const invariantVars = invariants.getList().reduce(
        (acc, prop) => ({
            ...acc,
            ...prop.getWebTokenValue(componentName, theme, themeMode),
        }),
        {},
    );

    return {
        ...variationsVars,
        ...invariantVars,
    };
};

export const modeList = [
    {
        label: 'Тёмный',
        value: 'dark',
    },
    {
        label: 'Светлый',
        value: 'light',
    },
];
