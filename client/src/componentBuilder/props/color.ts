import { getRestoredColorFromPalette, type ThemeMode } from '@salutejs/plasma-tokens-utils';

import type { Theme } from '../../themeBuilder';
import type { PlatformTokens, PropConfig, State } from '../type';
import { Prop } from './prop';

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
        const token = theme?.getTokenValue(`${themeMode}.${tokenName}`, 'color', 'web');

        if (!token) {
            return this.value;
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
            const getValue = ({ value }: State) =>
                theme ? this.getThemeValue(value, theme, themeMode) : this.getCSSVar(value);

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
