import { getRestoredColorFromPalette, type ThemeMode } from '@salutejs/plasma-tokens-utils';

import { camelToKebab } from '../../_new/utils';
import { capitalize } from '../utils';
import type { Theme } from '../../themeBuilder';
import type { PropConfig, WebToken } from '../type';
import { Prop } from './prop';

export class ColorProp extends Prop {
    protected readonly type = 'color';

    constructor(name: string, data: PropConfig, webTokens?: WebToken[] | null) {
        super(name, data, webTokens);
    }

    private getCSSVar(value: string | number) {
        const [category, subcategory, name] = value.toString().split('.');
        const tokenValue = [subcategory === 'default' ? '-' : `--${subcategory}`, category, name].join('-');

        return `var(${tokenValue})`;
    }

    private getThemeValue(tokenName: string, theme: Theme, themeMode?: ThemeMode) {
        const token = theme.getTokenValue(`${themeMode}.${tokenName}`, 'color', 'web');

        if (!token) {
            return this.value;
        }

        return getRestoredColorFromPalette(token, -1);
    }

    private getAdditionalTokens(token: string, theme?: Theme, themeMode?: ThemeMode) {
        if (!this.states?.length) {
            return null;
        }

        const statesMap = {
            hovered: 'Hover',
            pressed: 'Active',
        };

        return this.states.reduce((acc, item) => {
            const state = item.state[0] as keyof typeof statesMap; // TODO поддержать работу с несколькими стейтами
            const tokenName = `--plasma${capitalize(token)}${statesMap[state]}`;
            const value = theme ? this.getThemeValue(item.value, theme, themeMode) : this.getCSSVar(item.value);

            return {
                ...acc,
                [camelToKebab(tokenName)]: value,
            };
        }, {});
    }

    public getWebTokenValue(theme?: Theme, themeMode?: ThemeMode) {
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
            return {
                ...acc,
                ...this.getAdditionalTokens(name, theme, themeMode),
            };
        }, {});

        return {
            ...this.createWebToken(value),
            ...additionalValues,
        };
    }
}
