import { TokenType } from '../types/index.ts';
import { kebabToCamel } from '../utils/index.ts';

const fontMap: Record<string, string> = {
    display: 'var(--plasma-typo-display-font-family)',
    body: 'var(--plasma-typo-body-font-family)',
    header: 'var(--plasma-typo-header-font-family)',
    text: 'var(--plasma-typo-text-font-family)',
};

const fontWeightMap: Record<string, string> = {
    bold: 'bold',
    medium: 'medium',
    normal: '',
};

const SYSTEM_GROUPS = ['display', 'body', 'header', 'text'];

/** Начало имени переменной системной группы: `header` опускается (`h1-bold`), своя группа идёт как есть. */
const groupPrefix: Record<string, string> = {
    display: 'dspl',
    text: 'text',
    body: 'body',
    header: '',
};

const formattedTokenName = (nameParts: string[]) => {
    const tokenName = [...nameParts];
    // Только собственные ключи: своя группа `constructor` не должна находить свойство `Object.prototype`.
    tokenName[0] = Object.hasOwn(groupPrefix, tokenName[0]) ? groupPrefix[tokenName[0]] : tokenName[0];
    tokenName[2] = fontWeightMap[tokenName[2]];

    return tokenName.filter(Boolean).join('-');
};

/** Семейство значения: системное — переменная своей группы, своё — переменная группы стиля [group]. */
const fontFamilyVariable = (familyRef: string, group: string) =>
    Object.hasOwn(fontMap, familyRef.split('.')[1])
        ? fontMap[familyRef.split('.')[1]]
        : `var(--plasma-typo-${group}-font-family)`;

/** Имя шрифта семейства [familyRef] по собственным ключам: семейство `constructor` — не `Object.prototype`. */
const familyName = (fontFamily: any, familyRef: string) =>
    Object.hasOwn(fontFamily ?? {}, familyRef.split('.')[1]) ? fontFamily[familyRef.split('.')[1]].name : undefined;

/**
 * Прерывает генерацию, если два токена одного экрана дают одну переменную пакета (CSS или JS-константу camelCase):
 * сервер не даёт создать такие стили, проверка защищает от данных в обход него.
 */
const assertUniqueVariables = (tokens: TokenType[]) => {
    const keys = tokens.map((token) => {
        const [screen, ...rest] = token.name.split('.');
        return `${screen}:${formattedTokenName(rest).replaceAll('-', '').toLowerCase()}`;
    });
    const repeated = keys.findIndex((key, index) => keys.indexOf(key) !== index);
    if (repeated < 0) return;
    const first = tokens[keys.indexOf(keys[repeated])].name;
    const name = formattedTokenName(tokens[repeated].name.split('.').slice(1));
    throw new Error(`Стили типографики ${first} и ${tokens[repeated].name} дают одну переменную пакета ${name}`);
};

const geBaseFonts = (fonts: Record<string, string>) =>
    [
        `  font-size: 16px;
  --plasma-typo-overflow-wrap: break-word;
  --plasma-typo-hyphens: auto;
  --plasma-typo-display-font-family: '${fonts.display}', sans-serif;
  --plasma-typo-body-font-family: '${fonts.body}', sans-serif;
  --plasma-typo-header-font-family: '${fonts.header}', sans-serif;
  --plasma-typo-text-font-family: '${fonts.text}', sans-serif;`,
        // Свои группы: переменная семейства группы — для стилей со своим семейством.
        ...Object.keys(fonts)
            .filter((group) => !SYSTEM_GROUPS.includes(group))
            .map((group) => `  --plasma-typo-${group}-font-family: '${fonts[group]}', sans-serif;`),
    ].join('\n');

const getTypographyBase = (typography: any, fontFamily: any, tokens: TokenType[], size: 'screen-s') => {
    const fonts = tokens
        .filter((token) => token.tags[0] === size)
        .reduce((acc: Record<string, string>, token) => {
            const [, ...rest] = token.name.split('.');
            const kind = rest[0];
            const value = typography?.[token.name];

            if (Object.hasOwn(acc, kind) || !value) {
                return acc;
            }

            const fontFamilyRef = familyName(fontFamily, value.fontFamilyRef);

            return {
                [kind]: fontFamilyRef,
                ...acc,
            };
        }, {});

    return geBaseFonts(fonts);
};

const getTypographyRoot = (typography: any, tokens: TokenType[], size: 'screen-s') =>
    tokens
        .filter((token) => token.tags[0] === size)
        .map((token) => {
            const [, ...rest] = token.name.split('.');
            const tokenName = formattedTokenName(rest);
            const value = typography?.[token.name];

            if (!value) {
                return '';
            }

            const fontFamily = fontFamilyVariable(value.fontFamilyRef, rest[0]);
            const { letterSpacing, fontStyle } = value;

            return `  --plasma-typo-${tokenName}-font-family: ${fontFamily};
  --plasma-typo-${tokenName}-letter-spacing: ${letterSpacing};
  --plasma-typo-${tokenName}-font-style: ${fontStyle};`;
        })
        .join('\n');

const getJSVariable = (tokenName: string, description?: string) => {
    // INFO: Приведение размера Xs+ в верхний регистр для сохранения обратной совместимости
    const JSTokenName = kebabToCamel(tokenName).replace(/(Xx*s)/gm, (_, group) => group.toUpperCase());

    return `/** ${description} */
export const ${JSTokenName} = {
    fontFamily: 'var(--plasma-typo-${tokenName}-font-family)',
    fontSize: 'var(--plasma-typo-${tokenName}-font-size)',
    fontStyle: 'var(--plasma-typo-${tokenName}-font-style)',
    fontWeight: 'var(--plasma-typo-${tokenName}-font-weight)',
    letterSpacing: 'var(--plasma-typo-${tokenName}-letter-spacing)',
    lineHeight: 'var(--plasma-typo-${tokenName}-line-height)',
};
`;
};

const getCSSVariable = (tokenName: string, value: any) => {
    return `  --plasma-typo-${tokenName}-font-size: ${value.fontSize};
  --plasma-typo-${tokenName}-font-weight: ${value.fontWeight};
  --plasma-typo-${tokenName}-line-height: ${value.lineHeight};`;
};

const getResponsiveTypography = (
    typography: any,
    tokens: TokenType[],
    size: 'screen-s' | 'screen-m' | 'screen-l',
    isJS = false,
) =>
    tokens
        .filter((token) => token.tags[0] === size)
        .map((token) => {
            const [, ...rest] = token.name.split('.');
            const tokenName = formattedTokenName(rest);
            const value = typography?.[token.name];

            if (isJS || !value) {
                return getJSVariable(tokenName, token.description);
            }

            return getCSSVariable(tokenName, value);
        })
        .join('\n');

export const createTypographyTokens = (typography: any, fontFamily: any, tokens?: Array<TokenType>, isJS = false) => {
    if (!tokens?.length) {
        return {
            dark: {
                root: '',
                screenS: '',
                screenM: '',
                screenL: '',
            },
            light: {
                root: '',
                screenS: '',
                screenM: '',
                screenL: '',
            },
        };
    }

    assertUniqueVariables(tokens);

    const rootTypography = `${getTypographyBase(typography, fontFamily, tokens, 'screen-s')}\n${getTypographyRoot(
        typography,
        tokens,
        'screen-s',
    )}`;

    const screenSTypography = getResponsiveTypography(typography, tokens, 'screen-s', isJS);
    const screenMTypography = getResponsiveTypography(typography, tokens, 'screen-m', isJS);
    const screenLTypography = getResponsiveTypography(typography, tokens, 'screen-l', isJS);

    const data = {
        root: rootTypography,
        screenS: screenSTypography,
        screenM: screenMTypography,
        screenL: screenLTypography,
    };

    return {
        dark: data,
        light: data,
    };
};
