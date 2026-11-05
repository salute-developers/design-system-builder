import { TokenType } from '../types/index.ts';
import { kebabToCamel } from '../utils/index.ts';

const getJSVariable = (tokenName: string, description?: string, value?: string) => {
    const JSTokenName = kebabToCamel(`shadow-${tokenName}`);
    const variable = value ? `var(--shadow-${tokenName}, ${value})` : `var(--shadow-${tokenName})`;

    return `/** ${description} */\nexport const ${JSTokenName} = '${variable}';\n`;
};

const getCSSVariable = (tokenName: string, value: string[]) => {
    return `  --shadow-${tokenName}: ${value.join(', ')};`;
};

/**
 * Порядок теней в файле темы: сначала `down.*`, затем `up.*`, как раньше, затем остальные — имя тени произвольное,
 * и ни одна тень не должна пропасть из пакета.
 */
const SHADOW_ORDER = new Map([
    ['down', 0],
    ['up', 1],
]);
const shadowOrder = (token: TokenType) => SHADOW_ORDER.get(token.tags[0]) ?? 2;

const variableName = (token: TokenType) => token.name.split('.').join('-');

/** `down.soft.m` и `down-soft-m` дают одну переменную: такой пакет не собирается, поэтому генерация прерывается. */
const assertUniqueVariables = (tokens: TokenType[]) => {
    const names = new Map<string, string>();
    tokens.forEach((token) => {
        const other = names.get(variableName(token));
        if (other !== undefined) {
            throw new Error(`Тени ${other} и ${token.name} дают одну переменную --shadow-${variableName(token)}`);
        }
        names.set(variableName(token), token.name);
    });
};

const getShadow = (shadow: any, tokens: TokenType[], isJS = false) =>
    [...tokens]
        .sort((a, b) => shadowOrder(a) - shadowOrder(b))
        .map((token) => {
            const tokenName = variableName(token);
            const value = shadow?.[token.name];

            if (!value) {
                return getJSVariable(tokenName, token.description);
            }

            if (isJS) {
                return getJSVariable(tokenName, token.description, value);
            }

            return getCSSVariable(tokenName, value);
        })
        .join('\n');

export const createShadowTokens = (shadow: any, tokens?: Array<TokenType>, isJS = false) => {
    if (!tokens?.length) {
        return {
            dark: '',
            light: '',
        };
    }

    assertUniqueVariables(tokens);
    const shadows = getShadow(shadow, tokens, isJS);

    return {
        dark: shadows,
        light: shadows,
    };
};
