import { getRestoredColorFromPalette, type ThemeMode } from '@salutejs/plasma-tokens-utils';

import type { Theme } from '../../themeBuilder';
import type { PlatformTokens, PropConfig, PropState, State } from '../type';
import { Prop } from './prop';

// Суффиксы производных токенов темы для состояний (тема генерирует `<base>-hover` / `<base>-active`).
const stateSuffixMap: Record<PropState, string> = {
    hovered: '-hover',
    pressed: '-active',
};

export class ColorProp extends Prop {
    protected readonly type = 'color';

    constructor(name: string, data: PropConfig, platformTokens?: PlatformTokens) {
        super(name, data, platformTokens);
    }

    private getCSSVar(value?: string | number) {
        if (!value) {
            return;
        }

        if (value === 'transparent' || value === 'inherit') {
            return value;
        }

        const [category, subcategory, name] = value.toString().split('.');
        const tokenValue = [subcategory === 'default' ? '-' : `--${subcategory}`, category, name].join('-');

        return `var(${tokenValue})`;
    }

    private getThemeValue(tokenName?: string, theme?: Theme, themeMode?: ThemeMode) {
        if (!tokenName) {
            return undefined;
        }

        const token = theme?.getTokenValue(`${themeMode}.${tokenName}`, 'color', 'web');

        if (!token) {
            return undefined;
        }

        return getRestoredColorFromPalette(token, -1);
    }

    public getWebTokenValue(componentName?: string, theme?: Theme, themeMode?: ThemeMode) {
        if (!this.webTokens || !this.webTokens.length) {
            return;
        }

        // TODO: добавить нормальную проверку
        if (typeof this.value === 'number' || !this.value) {
            return;
        }

        const value = theme ? this.getThemeValue(this.value, theme, themeMode) : this.getCSSVar(this.value);

        if (!value) {
            return;
        }

        const additionalValues = this.webTokens.reduce((acc, { name }) => {
            const getValue = (state: State) => {
                const stateName = state.state[0];
                const stateTokenName = state.value ?? `${this.value}${stateSuffixMap[stateName]}`;

                return theme
                    ? this.getThemeValue(stateTokenName, theme, themeMode)
                    : this.getCSSVar(stateTokenName);
            };

            return {
                ...acc,
                ...this.getAdditionalTokens(name, getValue, componentName),
            };
        }, {});

        return {
            ...this.createWebToken(value, componentName),
            ...additionalValues,
        };
    }
}
