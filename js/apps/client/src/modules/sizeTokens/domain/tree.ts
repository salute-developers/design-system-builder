import { compareSizes, compareTokens, NAME_PREFIX, normalizeTokenName, shadowParts, shadowVariantNames } from './names';
import {
    SHADOW_VARIANTS,
    type CreateSizeTokenRequest,
    type ShadowLayer,
    type SizeToken,
    type SizeTokenKind,
} from './types';
import { parsePx, RANGES, SIZE_MESSAGES, validatePx } from './validation';

export const SECTION_LABELS: Record<SizeTokenKind, string> = { radius: 'Радиусы', spacing: 'Отступы', shadow: 'Тени' };

export interface TreeSection {
    kind: SizeTokenKind;
    label: string;
    tokens: SizeToken[];
}

/** Дерево: разделы «Радиусы», «Отступы», «Тени» в этом порядке; поиск — по имени без учёта регистра. */
export const buildSections = (tokens: readonly SizeToken[], query = ''): TreeSection[] => {
    const needle = query.trim().toLowerCase();
    return (['radius', 'spacing', 'shadow'] as const).map((kind) => ({
        kind,
        label: SECTION_LABELS[kind],
        tokens: tokens
            .filter((token) => token.kind === kind && (!needle || token.name.toLowerCase().includes(needle)))
            .sort(compareTokens),
    }));
};

/** Токен по умолчанию: `round.m`, иначе первый радиус, иначе первый токен дерева. */
export const defaultToken = (tokens: readonly SizeToken[]) =>
    tokens.find((token) => token.name === 'round.m') ??
    buildSections(tokens).flatMap((section) => section.tokens)[0] ??
    null;

/** Токены, которые удалит операция удаления: у тени — все четыре варианта размера. */
export const deletedTogether = (tokens: readonly SizeToken[], token: SizeToken) => {
    if (token.kind !== 'shadow') return [token];
    const names = new Set(shadowVariantNames(shadowParts(token.name).size));
    return tokens.filter((item) => item.kind === 'shadow' && names.has(item.name)).sort(compareTokens);
};

/** Компонент, который использует удаляемые токены, и имена этих токенов. */
export interface DeletedUsage {
    name: string;
    tokens: string[];
}

/**
 * Использование удаляемых токенов компонентами: у тени — объединение использований четырёх вариантов размера,
 * у компонента перечислены варианты, которые он использует.
 */
export const deletionUsage = (tokens: readonly SizeToken[], token: SizeToken): DeletedUsage[] => {
    const byComponent = new Map<string, string[]>();
    deletedTogether(tokens, token).forEach((item) =>
        item.components.forEach(({ name }) => byComponent.set(name, [...(byComponent.get(name) ?? []), item.name])),
    );
    return [...byComponent].map(([name, used]) => ({ name, tokens: used }));
};

/** Слой новой тени, если в варианте ещё нет ни одного размера. */
export const DEFAULT_SHADOW_LAYER: ShadowLayer = { offsetX: 0, offsetY: 2, blur: 4, spread: 0, color: '#0000001F' };

/** Самый крупный размер варианта тени или `null`. */
export const largestShadowSize = (tokens: readonly SizeToken[], variant?: string) => {
    const sizes = tokens
        .filter((token) => token.kind === 'shadow' && (!variant || shadowParts(token.name).variant === variant))
        .map((token) => shadowParts(token.name).size)
        .sort(compareSizes);
    return sizes.length ? sizes[sizes.length - 1] : null;
};

/** Варианты нового размера тени: слои и запасная высота копируются с самого крупного размера каждого варианта. */
export const newShadowVariants = (tokens: readonly SizeToken[]) =>
    SHADOW_VARIANTS.map((variant) => {
        const size = largestShadowSize(tokens, variant);
        const source = tokens.find((token) => token.kind === 'shadow' && token.name === `${variant}.${size}`);
        return source?.kind === 'shadow'
            ? {
                  variant,
                  layers: source.layers.map((layer) => ({ ...layer })),
                  fallbackElevation: source.fallbackElevation,
              }
            : { variant, layers: [{ ...DEFAULT_SHADOW_LAYER }], fallbackElevation: 0 };
    });

export interface NewTokenInput {
    kind: SizeTokenKind;
    name: string;
    value: string;
}

/** Полные имена токенов, которые создаст ввод имени нового токена. */
export const newTokenNames = (kind: SizeTokenKind, name: string) =>
    kind === 'shadow' ? shadowVariantNames(name) : [`${NAME_PREFIX[kind]}${name}`];

/**
 * Значение нового радиуса или отступа, созданного строкой в дереве: имя отступа вида `14x` даёт значение по правилу
 * темы (N × 2 px), иначе копируется самое крупное значение раздела, как значения по умолчанию у «Цветов».
 */
export const defaultNewValue = (kind: 'radius' | 'spacing', name: string, tokens: readonly SizeToken[]) => {
    const scale = normalizeTokenName(name).match(/^(\d+)x$/);
    if (kind === 'spacing' && scale) return String(Number(scale[1]) * 2);
    const values = tokens.flatMap((token) =>
        (token.kind === 'radius' || token.kind === 'spacing') && token.kind === kind && token.valuePx !== null
            ? [token.valuePx]
            : [],
    );
    return String(values.length ? Math.max(...values) : 0);
};

/** Тело операции создания по имени из строки дерева: значение — по умолчанию раздела. */
export const newTokenFromName = (kind: SizeTokenKind, name: string, tokens: readonly SizeToken[]) =>
    newTokenRequest({ kind, name, value: kind === 'shadow' ? '' : defaultNewValue(kind, name, tokens) }, tokens);

/** Тело операции создания по вводу или текст ошибки ввода. */
export const newTokenRequest = (
    input: NewTokenInput,
    tokens: readonly SizeToken[],
): { request: CreateSizeTokenRequest } | { error: string } => {
    const name = normalizeTokenName(input.name);
    if (!name) return { error: SIZE_MESSAGES.name };
    const taken = newTokenNames(input.kind, name).find((full) => tokens.some((token) => token.name === full));
    if (taken) return { error: SIZE_MESSAGES.exists(taken) };
    if (input.kind === 'shadow') return { request: { kind: 'shadow', name, variants: newShadowVariants(tokens) } };
    const error = validatePx(input.value, RANGES[input.kind]);
    if (error) return { error };
    return { request: { kind: input.kind, name, valuePx: parsePx(input.value) } };
};
