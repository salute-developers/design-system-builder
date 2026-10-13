import type { Config, Props } from '../../../controllers';
import { parseMemberName, type ColorTokenKey, type ComponentStyleSource, type StyleColorProp } from '../domain';

const colorProps = (props: Props | undefined): StyleColorProp[] =>
    (props?.getList() ?? []).flatMap((prop) => {
        const value = prop.getValue();
        if (prop.getType() !== 'color' || typeof value !== 'string' || !value) return [];
        return [
            {
                name: prop.getName(),
                token: value,
                states: (prop.getStates() ?? []).map((item) => ({
                    state: item.state[0],
                    token: typeof item.value === 'string' ? item.value : undefined,
                })),
                web: Boolean(prop.getWebTokens()?.length),
            },
        ];
    });

/** Стили вариаций компонентов дизайн-системы с цветовыми свойствами — источник пар контраста. */
export const componentStyleSources = (configs: readonly Config[]): ComponentStyleSource[] =>
    configs.flatMap((config) =>
        config.getVariations().flatMap((variation) =>
            (variation.getStyles() ?? []).map((style) => ({
                component: config.getName(),
                variation: variation.getName(),
                style: style.getName(),
                props: colorProps(style.getProps()),
            })),
        ),
    );

/** Компоненты, в стилях или общих свойствах которых используется любое определение токена [key]. */
export const componentsUsingToken = (configs: readonly Config[], key: ColorTokenKey): string[] => {
    const uses = (props: Props | undefined) =>
        colorProps(props).some((prop) =>
            [prop.token, ...prop.states.map((state) => state.token)].some((token) => {
                const parsed = token ? parseMemberName(token) : null;
                return parsed?.group === key.group && parsed.name === key.name;
            }),
        );
    return configs
        .filter(
            (config) =>
                uses(config.getInvariants()) ||
                config
                    .getVariations()
                    .some((variation) => (variation.getStyles() ?? []).some((style) => uses(style.getProps()))),
        )
        .map((config) => config.getName());
};
