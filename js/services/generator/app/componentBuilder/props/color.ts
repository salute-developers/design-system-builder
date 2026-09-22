import { getRestoredColorFromPalette, type ThemeMode } from '@salutejs/plasma-tokens-utils';

import type { PlatformTokens, PropConfig, PropState, State, ThemeValues, WebTokenValues } from '../type';
import { Prop } from './prop';

// Суффиксы производных токенов темы для состояний (тема генерирует `<base>-hover` / `<base>-active`).
const stateSuffixMap: Record<PropState, string> = {
    hovered: '-hover',
    pressed: '-active',
};

const isTokenName = (value: string | number) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(value.toString());

export class ColorProp extends Prop {
    protected readonly type = 'color';

    constructor(name: string, data: PropConfig, platformTokens?: PlatformTokens) {
        super(name, data, platformTokens);
    }

    private getCSSVar(value?: string | number) {
        if (!value) {
            return;
        }

        // Литерал цвета (`transparent`, `#F3A912`, `rgba(...)`) — не имя токена, уходит в CSS как есть.
        if (!isTokenName(value)) {
            return value;
        }

        const [category, subcategory, name] = value.toString().split('.');
        const tokenValue = [subcategory === 'default' ? '-' : `--${subcategory}`, category, name].join('-');

        return `var(${tokenValue})`;
    }

    private getThemeValue(tokenName?: string, theme?: ThemeValues, themeMode?: ThemeMode) {
        if (!tokenName) {
            return undefined;
        }

        if (!isTokenName(tokenName)) {
            return tokenName;
        }

        const token = theme?.getTokenValue(`${themeMode}.${tokenName}`, 'color', 'web');

        if (!token) {
            return undefined;
        }

        return getRestoredColorFromPalette(token, -1);
    }

    public getWebTokenValue(theme?: ThemeValues, themeMode?: ThemeMode): WebTokenValues | undefined {
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

        const additionalValues = this.webTokens.reduce<WebTokenValues>((acc, { name }) => {
            const getValue = (state: State) => {
                const stateName = state.state[0];
                const stateTokenName = state.value ?? `${this.value}${stateSuffixMap[stateName]}`;

                return theme
                    ? this.getThemeValue(stateTokenName, theme, themeMode)
                    : this.getCSSVar(stateTokenName);
            };

            return {
                ...acc,
                ...this.getAdditionalTokens(name, getValue),
            };
        }, {});

        return {
            ...this.createWebToken(value),
            ...additionalValues,
        };
    }
}
