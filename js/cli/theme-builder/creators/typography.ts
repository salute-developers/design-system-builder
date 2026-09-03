import type { ModeTokens, ThemeToken, ThemeVariations, TypographyTokens } from '../types.ts';
import { kebabToCamel } from '../utils.ts';

const FONT_VARIABLES: Record<string, string> = {
    display: 'var(--plasma-typo-display-font-family)',
    body: 'var(--plasma-typo-body-font-family)',
    header: 'var(--plasma-typo-header-font-family)',
    text: 'var(--plasma-typo-text-font-family)',
};

const FONT_WEIGHTS: Record<string, string> = {
    bold: 'bold',
    medium: 'medium',
    normal: '',
};

const formatTokenName = (parts: string[]) => {
    const kindAliases: Record<string, string> = {
        display: 'dspl',
        text: 'text',
        body: 'body',
    };
    const tokenName = [...parts];
    tokenName[0] = kindAliases[tokenName[0]];
    tokenName[2] = FONT_WEIGHTS[tokenName[2]];
    return tokenName.filter(Boolean).join('-');
};

const createBaseTokens = (
    typography: ThemeVariations['typography'],
    fontFamily: ThemeVariations['fontFamily'],
    tokens: ThemeToken[],
) => {
    const fonts = tokens
        .filter((token) => token.tags[0] === 'screen-s')
        .reduce<Record<string, string>>((result, token) => {
            const [, kind] = token.name.split('.');
            const value = typography[token.name];

            if (result[kind] || !value) {
                return result;
            }

            const familyKind = value.fontFamilyRef.split('.')[1];
            return { [kind]: fontFamily[familyKind]?.name, ...result };
        }, {});

    return `  font-size: 16px;
  --plasma-typo-overflow-wrap: break-word;
  --plasma-typo-hyphens: auto;
  --plasma-typo-display-font-family: '${fonts.display}', sans-serif;
  --plasma-typo-body-font-family: '${fonts.body}', sans-serif;
  --plasma-typo-header-font-family: '${fonts.header}', sans-serif;
  --plasma-typo-text-font-family: '${fonts.text}', sans-serif;`;
};

const createRootTokens = (typography: ThemeVariations['typography'], tokens: ThemeToken[]) =>
    tokens
        .filter((token) => token.tags[0] === 'screen-s')
        .map((token) => {
            const [, ...parts] = token.name.split('.');
            const tokenName = formatTokenName(parts);
            const value = typography[token.name];

            if (!value) {
                return '';
            }

            const family = FONT_VARIABLES[value.fontFamilyRef.split('.')[1]];
            return `  --plasma-typo-${tokenName}-font-family: ${family};
  --plasma-typo-${tokenName}-letter-spacing: ${value.letterSpacing};
  --plasma-typo-${tokenName}-font-style: ${value.fontStyle};`;
        })
        .join('\n');

const createResponsiveTokens = (
    typography: ThemeVariations['typography'],
    tokens: ThemeToken[],
    size: 'screen-s' | 'screen-m' | 'screen-l',
    isJavaScript: boolean,
) =>
    tokens
        .filter((token) => token.tags[0] === size)
        .map((token) => {
            const [, ...parts] = token.name.split('.');
            const tokenName = formatTokenName(parts);
            const value = typography[token.name];

            if (isJavaScript || !value) {
                const variableName = kebabToCamel(tokenName).replace(/(Xx*s)/gm, (_, group: string) =>
                    group.toUpperCase(),
                );
                return `/** ${token.description} */
export const ${variableName} = {
    fontFamily: 'var(--plasma-typo-${tokenName}-font-family)',
    fontSize: 'var(--plasma-typo-${tokenName}-font-size)',
    fontStyle: 'var(--plasma-typo-${tokenName}-font-style)',
    fontWeight: 'var(--plasma-typo-${tokenName}-font-weight)',
    letterSpacing: 'var(--plasma-typo-${tokenName}-letter-spacing)',
    lineHeight: 'var(--plasma-typo-${tokenName}-line-height)',
};
`;
            }

            return `  --plasma-typo-${tokenName}-font-size: ${value.fontSize};
  --plasma-typo-${tokenName}-font-weight: ${value.fontWeight};
  --plasma-typo-${tokenName}-line-height: ${value.lineHeight};`;
        })
        .join('\n');

export function createTypographyTokens(
    typography: ThemeVariations['typography'],
    fontFamily: ThemeVariations['fontFamily'],
    tokens: ThemeToken[] = [],
    isJavaScript = false,
): ModeTokens<TypographyTokens> {
    const content = {
        root: `${createBaseTokens(typography, fontFamily, tokens)}\n${createRootTokens(typography, tokens)}`,
        screenS: createResponsiveTokens(typography, tokens, 'screen-s', isJavaScript),
        screenM: createResponsiveTokens(typography, tokens, 'screen-m', isJavaScript),
        screenL: createResponsiveTokens(typography, tokens, 'screen-l', isJavaScript),
    };

    return { dark: content, light: content };
}
