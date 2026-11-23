import { typographyPartFor, typographyVariableBase } from '../../../web-mapping/index.ts';
import type { PlatformTokens, PropConfig, ThemeValues, WebTokenValues } from '../type.ts';
import { Prop } from './prop.ts';

export class TypographyProp extends Prop {
    protected readonly type = 'typography';

    constructor(name: string, data: PropConfig, platformTokens?: PlatformTokens) {
        super(name, data, platformTokens);
    }

    private getCSSVar(value: string | number) {
        const tokenValue = typographyVariableBase(value.toString());

        return {
            fontFamily: `var(--plasma-typo-${tokenValue}-font-family)`,
            fontSize: `var(--plasma-typo-${tokenValue}-font-size)`,
            fontStyle: `var(--plasma-typo-${tokenValue}-font-style)`,
            fontWeight: `var(--plasma-typo-${tokenValue}-font-weight)`,
            letterSpacing: `var(--plasma-typo-${tokenValue}-letter-spacing)`,
            lineHeight: `var(--plasma-typo-${tokenValue}-line-height)`,
        };
    }

    private getThemeValue(theme: ThemeValues) {
        // TODO: Возможно сделать динамическим размер экрана screen-s
        const token = theme.getTokenValue(`screen-s.${this.value}`, 'typography', 'web');

        if (!token) {
            return;
        }

        const { fontFamilyRef, ...restTokens } = token;

        const tokenName = fontFamilyRef.split('.')[1] || '';
        const fontFamily = theme.getTokenValue(tokenName, 'fontFamily', 'web');

        return {
            fontFamily: fontFamily?.name,
            ...restTokens,
        };
    }

    public createWebToken(value?: string | number | Record<string, any>): WebTokenValues | null {
        if (!this.webTokens || !this.webTokens.length || !value || typeof value !== 'object') {
            return null;
        }

        return this.webTokens.reduce<WebTokenValues>((acc, { name }) => {
            const tokenKey = typographyPartFor(name);

            if (!tokenKey || !Object.hasOwn(value, tokenKey)) {
                return acc;
            }

            return {
                ...acc,
                [name]: value[tokenKey],
            };
        }, {});
    }

    public getWebTokenValue(theme?: ThemeValues) {
        if (this.value === undefined || typeof this.value === 'number' || !this.value) {
            return;
        }

        const value = theme ? this.getThemeValue(theme) : this.getCSSVar(this.value);

        if (!this.webTokens || !this.webTokens.length) {
            return;
        }

        return {
            ...this.createWebToken(value),
        };
    }
}
