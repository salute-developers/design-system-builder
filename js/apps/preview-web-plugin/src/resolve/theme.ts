import type { PreviewAsset, PreviewPayload } from '../protocol';
import { fontFamilyName, toCssColor, type ThemeTokens } from './tokens';
import { typographyValues, type TypographyPart } from './typography';
import { pathKey, type WarningSink } from './warnings';

const MODES = new Set(['light', 'dark']);

/**
 * Имя CSS-переменной окружения для цветового токена, правило бывшего `createThemeVars` клиента:
 * `<режим>.<категория>.<подкатегория>.<имя>` → `--<категория>-<имя>` для подкатегории `default`, иначе
 * `--<подкатегория>-<категория>-<имя>` (`dark.text.default.primary` → `--text-primary`,
 * `dark.surface.on-dark.solid-default` → `--on-dark-surface-solid-default`). Идентификатор без режима
 * (`text.default.primary`) разбирается так же. Прочие идентификаторы переменной не дают.
 */
export const themeVariableName = (tokenId: string): string | undefined => {
    const parts = tokenId.split('.');
    const rest = parts.length === 4 && MODES.has(parts[0]) ? parts.slice(1) : parts.length === 3 ? parts : undefined;
    if (!rest || rest.some((part) => !part)) return undefined;
    const [category, subcategory, name] = rest;
    return [subcategory === 'default' ? '-' : `--${subcategory}`, category, name].join('-');
};

const kebab = (value: string) => value.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

/**
 * Основа имени переменных типографики темы по правилу генератора тем: имя токена через дефис, суффикс `normal`
 * опускается (`text.m.bold` → `text-m-bold`, `text.m.normal` → `text-m`, `header.h1.medium` → `header-h1-medium`).
 */
export const typographyVariableBase = (tokenId: string): string =>
    tokenId.replace(/\.normal$/, '').split('.').join('-');

/**
 * Переменные типографики темы из токенов `typography`: `--plasma-typo-<основа>-<поле>` для полей `font-family`,
 * `font-weight`, `font-style`, `font-size`, `line-height`, `letter-spacing`, и `--plasma-typo-<группа>-font-family`
 * по семейству первого токена группы (`text`, `body`, `header`, `display`). На них ссылаются значения свойств ДС
 * (`var(--plasma-typo-text-m-bold-font-weight)`).
 */
export const typographyThemeVariables = (theme: ThemeTokens): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const [tokenId, token] of Object.entries(theme)) {
        if (token.type !== 'typography') continue;
        const base = typographyVariableBase(tokenId);
        const values = typographyValues(token, theme);
        for (const [part, value] of Object.entries(values) as Array<[TypographyPart, string | undefined]>) {
            if (value !== undefined) result[`--plasma-typo-${base}-${kebab(part)}`] = value;
        }
        const group = `--plasma-typo-${tokenId.split('.')[0]}-font-family`;
        if (values.fontFamily && !(group in result)) result[group] = values.fontFamily;
    }
    return result;
};

/** CSS-переменные окружения story: цвета и типографика темы из `theme`. */
export const themeVariables = (theme: ThemeTokens): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const [tokenId, token] of Object.entries(theme)) {
        if (token.type !== 'color') continue;
        const name = themeVariableName(tokenId);
        if (name) result[name] = toCssColor(token.value);
    }
    return { ...result, ...typographyThemeVariables(theme) };
};

/** Фон области превью из `surface.background`: цветовой токен темы, цвет `#RRGGBBAA` или CSS-значение как есть. */
export const surfaceBackground = (payload: PreviewPayload): string | undefined => {
    const background = payload.surface?.background;
    if (!background) return undefined;
    const token = payload.theme[background];
    if (token?.type === 'color') return toCssColor(token.value);
    return background;
};

/** Идентификаторы токена шрифта тела, как `theme.getTokenValue('body', 'fontFamily', 'web')` прежнего клиента. */
const BODY_FONT_TOKENS = ['fontFamily.body', 'body'];

/**
 * Шрифт области превью: токен семейства `body`, а без него — семейство текстового стиля по умолчанию
 * (`defaults.text.style`).
 */
export const bodyFontFamily = (payload: PreviewPayload): string | undefined => {
    const bodyId = BODY_FONT_TOKENS.find((id) => payload.theme[id]?.type === 'fontFamily');
    if (bodyId) return fontFamilyName(bodyId);
    const styleId = payload.defaults?.text?.style;
    const style = styleId ? payload.theme[styleId] : undefined;
    if (style?.type === 'typography' && payload.theme[style.fontFamilyTokenId]?.type === 'fontFamily') {
        return fontFamilyName(style.fontFamilyTokenId);
    }
    return undefined;
};

const FONT_FORMATS: Partial<Record<PreviewAsset['type'], string>> = {
    WOFF2: 'woff2',
    WOFF: 'woff',
    TTF: 'truetype',
    OTF: 'opentype',
};

const cssString = (value: string) => `'${value.replace(/['\\]/g, (char) => `\\${char}`)}'`;

/**
 * `@font-face` по начертаниям токенов `fontFamily` из `assets` (`WOFF2`, `WOFF`, `TTF`, `OTF`). Семейство называется
 * по токену (`fontFamilyName`), как его пишут параметры ядра. Ресурс другого типа или без записи в `assets`
 * пропускается с предупреждением: браузер возьмёт шрифт по умолчанию.
 */
export const fontFaces = (payload: PreviewPayload, warnings: WarningSink): string => {
    const assets = new Map(payload.assets.map((asset) => [asset.id, asset]));
    const rules: string[] = [];
    for (const [tokenId, token] of Object.entries(payload.theme)) {
        if (token.type !== 'fontFamily') continue;
        for (const face of token.faces) {
            const asset = assets.get(face.assetId);
            const format = asset ? FONT_FORMATS[asset.type] : undefined;
            if (!asset || !format) {
                warnings.add(
                    asset ? 'unsupported_font_format' : 'missing_asset',
                    asset
                        ? `Font asset ${face.assetId} of ${tokenId} has unsupported type ${asset.type}`
                        : `Font asset ${face.assetId} of ${tokenId} is missing`,
                    `$.theme${pathKey(tokenId)}`,
                );
                continue;
            }
            rules.push(
                [
                    '@font-face {',
                    `    font-family: ${fontFamilyName(tokenId)};`,
                    `    src: url(${cssString(asset.url)}) format('${format}');`,
                    `    font-weight: ${face.weight};`,
                    `    font-style: ${face.style === 'ITALIC' ? 'italic' : 'normal'};`,
                    '    font-display: swap;',
                    '}',
                ].join('\n'),
            );
        }
    }
    return rules.join('\n');
};
