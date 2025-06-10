import { camelToKebab } from '../../_new/utils';
import { capitalize } from '../utils';
import type { Theme } from '../../themeBuilder';
import type { PropConfig, WebToken } from '../type';
import { Prop } from './prop';

export class TypographyProp extends Prop {
    protected readonly type = 'typography';

    constructor(name: string, data: PropConfig, webTokens?: WebToken[] | null) {
        super(name, data, webTokens);
    }

    private formattedTokenName(nameParts: string[]) {
        const fontWeightMap: Record<string, string> = {
            bold: 'bold',
            medium: 'medium',
            normal: '',
        };

        const nameMap: Record<string, string> = {
            display: 'dspl',
            text: 'text',
            body: 'body',
        };

        const tokenValue = [...nameParts];
        tokenValue[0] = nameMap[tokenValue[0]];
        tokenValue[2] = fontWeightMap[tokenValue[2]];

        return tokenValue.filter(Boolean).join('-');
    }

    private getCSSVar(value: string | number) {
        const tokenValue = this.formattedTokenName(value.toString().split('.'));

        return {
            fontFamily: `var(--plasma-typo-${tokenValue}-font-family)`,
            fontSize: `var(--plasma-typo-${tokenValue}-font-size)`,
            fontStyle: `var(--plasma-typo-${tokenValue}-font-style)`,
            fontWeight: `var(--plasma-typo-${tokenValue}-font-weight)`,
            letterSpacing: `var(--plasma-typo-${tokenValue}-letter-spacing)`,
            lineHeight: `var(--plasma-typo-${tokenValue}-line-height)`,
        };
    }

    private getThemeValue(theme: Theme) {
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

    public createWebToken(value?: string | number | Record<string, any>) {
        if (!this.webTokens || !this.webTokens.length || !value || typeof value !== 'object') {
            return null;
        }

        return this.webTokens?.reduce((acc, { name }) => {
            const tokenName = `--plasma${capitalize(name)}`;
            const tokenKey = Object.keys(value).find((key) =>
                name.toLocaleLowerCase().includes(key.toLocaleLowerCase()),
            );

            if (!tokenKey) {
                return acc;
            }

            return {
                ...acc,
                [camelToKebab(tokenName)]: value[tokenKey],
            };
        }, {});
    }

    public getWebTokenValue(theme?: Theme) {
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
