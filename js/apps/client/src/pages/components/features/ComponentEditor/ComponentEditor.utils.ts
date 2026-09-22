import { getRestoredColorFromPalette } from '@salutejs/plasma-tokens-utils';
import { component, mergeConfig } from '@salutejs/plasma-new-hope/styled-components';

import { Config, DesignSystem, Theme, createThemeConfig, getCoreConfig, toCSSVariables } from '../../../../controllers';

export const createThemeVars = (theme: Theme, themeMode: any) => {
    return theme
        .getTokens('color')
        .filter((item) => item.getEnabled() && item.getTags()[0] === themeMode)
        .reduce((acc, token) => {
            const [, category, subcategory, name] = token.getName().split('.');
            const tokenName = [subcategory === 'default' ? '-' : `--${subcategory}`, category, name].join('-');

            return {
                ...acc,
                [tokenName]: getRestoredColorFromPalette(token.getValue('web'), -1),
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
                    ...toCSSVariables(componentName, prop.getWebTokenValue(theme, themeMode)),
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
            ...toCSSVariables(componentName, prop.getWebTokenValue(theme, themeMode)),
        }),
        {},
    );

    return {
        ...variationsVars,
        ...invariantVars,
    };
};

export const createRelatedComponentVars = (
    designSystem: DesignSystem,
    config: Config,
    args: Record<string, string | boolean>,
    theme: Theme,
    themeMode: any,
    cache: Map<string, Config>,
) => {
    const currentName = config.getName();
    const all = designSystem.getComponentsData();
    const current = all.find((item) => item.name === currentName);

    // Только `compose`: дочерний живёт внутри родителя (Tabs → TabItem) и делит с ним значения
    // одноимённых вариаций, поэтому связь нужна в обе стороны.
    //
    // Для `reuse` переменные на сцену не кладутся: чужой компонент рендерит стори, и ему нужен
    // полный конфиг темы (`createRelatedComponents`), а не одно вычисленное значение. Иначе
    // переменная приезжает в дефолтном виде и побеждает: у кнопки внутри Drawer белый фон, на
    // котором ядро рисует белый крестик.
    const childNames = (current?.deps ?? []).filter((dep) => dep.type === 'compose').map((dep) => dep.childName);
    const parentNames = all
        .filter((item) => (item.deps ?? []).some((dep) => dep.type === 'compose' && dep.childName === currentName))
        .map((item) => item.name);
    const relatedNames = [...childNames, ...parentNames].filter((name): name is string => Boolean(name));

    const styleNameOf = (value: string | boolean, variationID: string) =>
        typeof value === 'string' ? config.getStyleByVariation(variationID, value)?.getName() : undefined;

    return relatedNames.reduce<Record<string, string>>((acc, name) => {
        if (!cache.has(name)) {
            const meta = all.find((item) => item.name === name);

            if (!meta) {
                return acc;
            }

            cache.set(name, new Config(meta));
        }

        const related = cache.get(name)!;

        const relatedArgs: Record<string, string> = {};

        for (const item of related.getDefaults()) {
            relatedArgs[item.getVariation()] = item.getStyleID();
        }

        for (const variation of config.getVariations()) {
            const value = args[variation.getName()];
            const styleName = value !== undefined ? styleNameOf(value, variation.getID()) : undefined;
            const relatedVariation = related.getVariations().find((item) => item.getName() === variation.getName());
            const relatedStyle = relatedVariation?.getStyles()?.find((item) => item.getName() === styleName);

            if (relatedVariation && relatedStyle) {
                relatedArgs[relatedVariation.getName()] = relatedStyle.getID();
            }
        }

        return { ...acc, ...createComponentVars(related, theme, relatedArgs, themeMode) };
    }, {});
};

export const createRelatedComponents = (
    designSystem: DesignSystem,
    config: Config,
    theme: Theme,
    themeMode: any,
    cache: Map<string, Config>,
) => {
    const currentName = config.getName();
    const all = designSystem.getComponentsData();
    const current = all.find((item) => item.name === currentName);

    const names = [currentName, ...(current?.deps ?? []).map((dep) => dep.childName)].filter((name): name is string =>
        Boolean(name),
    );

    return names.reduce<Record<string, unknown>>((acc, name) => {
        if (name !== currentName && !cache.has(name)) {
            const meta = all.find((item) => item.name === name);
            if (!meta) {
                return acc;
            }
            cache.set(name, new Config(meta));
        }

        const related = name === currentName ? config : cache.get(name)!;
        const themeConfig = createThemeConfig(related, theme, themeMode);
        const coreConfig = getCoreConfig(name);

        if (!coreConfig || typeof coreConfig === 'function') {
            return { ...acc, [`${name}Config`]: themeConfig };
        }

        const merged = mergeConfig(coreConfig as any, themeConfig as any);

        return { ...acc, [name]: component(merged as any), [`${name}Config`]: merged };
    }, {});
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
