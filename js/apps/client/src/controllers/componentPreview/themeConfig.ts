import { css } from '@salutejs/plasma-new-hope/styled-components';

import type { Theme } from '../themeBuilder';
import type { Config, PropUnion } from '../componentBuilder';

import { toCSSVariables } from './coreTokens';


export const createThemeConfig = (config: Config, theme: Theme, themeMode: any) => {
    const componentName = config.getName();

    const toCSS = (vars: Record<string, string>) => {
        const entries = Object.entries(vars);

        if (entries.length === 0) {
            return css``;
        }

        const text = entries.map(([name, value]) => `${name}: ${value};`).join('\n');
        const template = Object.assign([text], { raw: [text] }) as unknown as TemplateStringsArray;

        return css(template);
    };

    const propsToVars = (props: PropUnion[]) =>
        props.reduce<Record<string, string>>(
            (acc, prop) => ({ ...acc, ...toCSSVariables(componentName, prop.getWebTokenValue(theme, themeMode)) }),
            {},
        );

    const variations = config.getVariations().reduce<Record<string, Record<string, unknown>>>((acc, variation) => {
        const styles = (variation.getStyles() ?? []).reduce<Record<string, unknown>>(
            (stylesAcc, style) => ({
                ...stylesAcc,
                [style.getName()]: toCSS(propsToVars(style.getProps().getList())),
            }),
            {},
        );

        return { ...acc, [variation.getName()]: styles };
    }, {});

    const defaults = config
        .getDefaults()
        .reduce<Record<string, string>>((acc, item) => ({ ...acc, [item.getVariation()]: item.getStyle() }), {});

    return {
        defaults,
        variations,
        invariants: toCSS(propsToVars(config.getInvariants().getList())),
    };
};
