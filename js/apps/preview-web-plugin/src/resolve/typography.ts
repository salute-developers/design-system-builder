import type { PreviewTokenValue } from '../protocol';
import type { ApiMetaParam } from './meta';
import { fontFamilyName, toRem, type ThemeTokens } from './tokens';

/** Поля типографики ядра в порядке объекта значения прежнего `TypographyProp` (`fontFamily`, затем web-токен). */
export const TYPOGRAPHY_PARTS = ['fontFamily', 'fontWeight', 'fontStyle', 'fontSize', 'lineHeight', 'letterSpacing'] as const;

export type TypographyPart = (typeof TYPOGRAPHY_PARTS)[number];

export type TypographyValues = Partial<Record<TypographyPart, string>>;

type TypographyToken = Extract<PreviewTokenValue, { type: 'typography' }>;

/** px → `em` от размера шрифта, с округлением до 4 знаков. */
const letterSpacingEm = (px: number, fontSize: number) =>
    px === 0 || !fontSize ? 'normal' : `${Math.round((px / fontSize) * 10000) / 10000}em`;

/**
 * Токен `typography` → значения параметров типографики ядра в CSS:
 * - `fontFamily` — семейство токена `fontFamilyTokenId` (если он есть в теме);
 * - `fontSize`, `lineHeight` — px → `rem`;
 * - `fontWeight` — число строкой;
 * - `fontStyle` — `normal`/`italic`, только если задан в токене (у прежнего клиента параметр без значения не писался);
 * - `letterSpacing` — протокол передаёт px, в CSS — доля размера шрифта в `em` (`-0.32` при `16` → `-0.02em`),
 *   как хранятся web-значения ДС; `0` → `normal`.
 */
export const typographyValues = (token: TypographyToken, theme: ThemeTokens): TypographyValues => {
    const family = theme[token.fontFamilyTokenId];
    return {
        ...(family?.type === 'fontFamily' ? { fontFamily: fontFamilyName(token.fontFamilyTokenId) } : {}),
        fontWeight: String(token.weight),
        ...(token.fontStyle ? { fontStyle: token.fontStyle.toLowerCase() } : {}),
        fontSize: toRem(token.fontSize),
        lineHeight: toRem(token.lineHeight),
        letterSpacing: letterSpacingEm(token.letterSpacing, token.fontSize),
    };
};

/**
 * Поле типографики для параметра ядра: `part` меты, а без него — первое поле, имя которого входит в `paramName`
 * без учёта регистра (`buttonFontSize` → `fontSize`, `typoFontLetterSpacing` → `letterSpacing`), как
 * `TypographyProp.createWebToken` прежнего клиента.
 */
export const typographyPartFor = (param: ApiMetaParam): TypographyPart | undefined => {
    if (param.part && (TYPOGRAPHY_PARTS as readonly string[]).includes(param.part)) return param.part as TypographyPart;
    const name = param.paramName.toLowerCase();
    return TYPOGRAPHY_PARTS.find((part) => name.includes(part.toLowerCase()));
};
