import { SHADOW_VARIANTS, type ShadowVariant, type SizeToken, type SizeTokenKind } from './types';

/** Правила имён `design.md`: токены вне правила в разделе не показываются. */
export const NAME_RULES: Record<SizeTokenKind, RegExp> = {
    radius: /^round\.[a-z0-9]+(-[a-z0-9]+)*$/,
    spacing: /^spacing\.[a-z0-9]+(-[a-z0-9]+)*$/,
    shadow: /^(down|up)\.(soft|hard)\.[a-z0-9]+(-[a-z0-9]+)*$/,
};

export const NAME_PREFIX: Record<'radius' | 'spacing', string> = { radius: 'round.', spacing: 'spacing.' };

/** Раздел токена темы по типу и имени или `null`, если имя вне правила. */
export const kindOfThemeToken = (type: string, name: string): SizeTokenKind | null => {
    const kind = type === 'shape' ? 'radius' : type === 'spacing' ? 'spacing' : type === 'shadow' ? 'shadow' : null;
    return kind && NAME_RULES[kind].test(name) ? kind : null;
};

export const FULL_ROUNDING_NAME = 'round.circle';

/** Части имени тени: `down.soft.m` → вариант `down.soft` и размер `m`. */
export const shadowParts = (name: string) => {
    const [direction, character, ...size] = name.split('.');
    return {
        direction: direction as 'down' | 'up',
        character: character as 'soft' | 'hard',
        variant: `${direction}.${character}` as ShadowVariant,
        size: size.join('.'),
    };
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** Подпись размера: `m` → `M`, `xxl` → `XXL`, остальное как есть. */
export const sizeLabel = (size: string) => (/^x*[sml]$/.test(size) ? size.toUpperCase() : size);

/** Короткое имя токена в дереве и на борде: «M», «Circle», «4x», «Down Soft S». */
export const shortName = (token: Pick<SizeToken, 'kind' | 'name'>) => {
    if (token.kind === 'shadow') {
        const { direction, character, size } = shadowParts(token.name);
        return `${capitalize(direction)} ${capitalize(character)} ${sizeLabel(size)}`;
    }
    const name = token.name.replace(/^(round|spacing)\./, '');
    return name === 'circle' ? 'Circle' : sizeLabel(name);
};

/** Подпись варианта тени: `down.soft` → «Down Soft». */
export const variantLabel = (variant: ShadowVariant) => variant.split('.').map(capitalize).join(' ');

/** Порядок размеров: …, xs, s, m, l, xl, …; размеры вне шкалы — после, по алфавиту. */
export const sizeRank = (size: string): number => {
    const small = /^(x*)s$/.exec(size);
    if (small) return -1 - small[1].length;
    if (size === 'm') return 0;
    const large = /^(x*)l$/.exec(size);
    if (large) return 1 + large[1].length;
    return 100;
};

export const compareSizes = (a: string, b: string) => sizeRank(a) - sizeRank(b) || a.localeCompare(b);

/** Порядок строк раздела: радиусы и отступы — по значению, полное скругление последним; тени — Down→Up, Soft→Hard, размер. */
export const compareTokens = (a: SizeToken, b: SizeToken): number => {
    if (a.kind === 'shadow' && b.kind === 'shadow') {
        const left = shadowParts(a.name);
        const right = shadowParts(b.name);
        return (
            SHADOW_VARIANTS.indexOf(left.variant) - SHADOW_VARIANTS.indexOf(right.variant) ||
            compareSizes(left.size, right.size)
        );
    }
    const value = (token: SizeToken) =>
        token.kind === 'shadow' || token.fullRounding || token.valuePx === null ? Infinity : token.valuePx;
    return value(a) - value(b) || a.name.localeCompare(b.name);
};

/** Размеры теней раздела по возрастанию. */
export const shadowSizes = (tokens: readonly SizeToken[]) =>
    [...new Set(tokens.filter((token) => token.kind === 'shadow').map((token) => shadowParts(token.name).size))].sort(
        compareSizes,
    );

/** Имена четырёх вариантов размера тени. */
export const shadowVariantNames = (size: string) => SHADOW_VARIANTS.map((variant) => `${variant}.${size}`);

/**
 * Имя нового токена из ввода: нижний регистр, слова через дефис. Пустая строка — ввод не даёт допустимого
 * имени (латиница и цифры).
 */
export const normalizeTokenName = (input: string) =>
    input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

/** Имя отступа по правилу темы `Nx = N × 2 px`: 28 → `14x`; для нечётного или неверного значения — пусто. */
export const spacingNameFromValue = (raw: string) => {
    const text = raw.trim();
    if (!/^\d+$/.test(text)) return '';
    const value = Number(text);
    return value % 2 === 0 ? `${value / 2}x` : '';
};
