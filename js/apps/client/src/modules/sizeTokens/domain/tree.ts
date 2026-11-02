import { compareTokens, NAME_PREFIX, normalizeShadowName, normalizeTokenName, shadowVariableKey } from './names';
import { type CreateSizeTokenRequest, type ShadowLayer, type SizeToken, type SizeTokenKind } from './types';
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

/** Токены, которые удалит операция удаления: только сам токен — тень тоже отдельный токен. */
export const deletedTogether = (_tokens: readonly SizeToken[], token: SizeToken) => [token];

/** Компонент, который использует удаляемые токены, и имена этих токенов. */
export interface DeletedUsage {
    name: string;
    tokens: string[];
}

/** Использование удаляемого токена компонентами: у компонента перечислено имя токена. */
export const deletionUsage = (tokens: readonly SizeToken[], token: SizeToken): DeletedUsage[] => {
    const byComponent = new Map<string, string[]>();
    deletedTogether(tokens, token).forEach((item) =>
        item.components.forEach(({ name }) => byComponent.set(name, [...(byComponent.get(name) ?? []), item.name])),
    );
    return [...byComponent].map(([name, used]) => ({ name, tokens: used }));
};

/** Слой новой тени: слои и параметры дальше настраиваются в инспекторе. */
export const DEFAULT_SHADOW_LAYER: ShadowLayer = { offsetX: 0, offsetY: 2, blur: 4, spread: 0, color: '#0000001F' };

export interface NewTokenInput {
    kind: SizeTokenKind;
    name: string;
    value: string;
}

/** Полное имя токена, который создаст ввод имени: у тени — само имя, у радиуса и отступа — с префиксом раздела. */
export const newTokenName = (kind: SizeTokenKind, name: string) =>
    kind === 'shadow' ? name : `${NAME_PREFIX[kind]}${name}`;

/** Имя нового токена из ввода без префикса раздела: у тени части через точку сохраняются. */
export const normalizeNewName = (kind: SizeTokenKind, input: string) =>
    kind === 'shadow' ? normalizeShadowName(input) : normalizeTokenName(input);

/** Токен раздела, с которым конфликтует новое полное имя: то же имя или, у теней, та же переменная пакета. */
export const conflictingToken = (kind: SizeTokenKind, full: string, tokens: readonly SizeToken[]) =>
    tokens.find(
        (token) =>
            token.name === full ||
            (kind === 'shadow' && token.kind === 'shadow' && shadowVariableKey(token.name) === shadowVariableKey(full)),
    );

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

/**
 * Новое имя токена из ввода переименования без префикса раздела или текст ошибки ввода. Префикс `round.` /
 * `spacing.` во вводе допустим: в шапке инспектора правится полное имя.
 */
export const renameRequest = (
    token: SizeToken,
    input: string,
    tokens: readonly SizeToken[],
): { name: string } | { error: string } => {
    const text = input.trim();
    const prefix = token.kind === 'shadow' ? '' : NAME_PREFIX[token.kind];
    const name = normalizeNewName(token.kind, text.toLowerCase().startsWith(prefix) ? text.slice(prefix.length) : text);
    if (!name) return { error: SIZE_MESSAGES.name };
    const others = tokens.filter((item) => item.tokenId !== token.tokenId);
    const conflict = conflictingToken(token.kind, newTokenName(token.kind, name), others);
    return conflict ? { error: SIZE_MESSAGES.exists(conflict.name) } : { name };
};

/** Тело операции создания по имени из строки дерева: значение — по умолчанию раздела. */
export const newTokenFromName = (kind: SizeTokenKind, name: string, tokens: readonly SizeToken[]) =>
    newTokenRequest({ kind, name, value: kind === 'shadow' ? '' : defaultNewValue(kind, name, tokens) }, tokens);

/** Тело операции создания по вводу или текст ошибки ввода. */
export const newTokenRequest = (
    input: NewTokenInput,
    tokens: readonly SizeToken[],
): { request: CreateSizeTokenRequest } | { error: string } => {
    const name = normalizeNewName(input.kind, input.name);
    if (!name) return { error: SIZE_MESSAGES.name };
    const conflict = conflictingToken(input.kind, newTokenName(input.kind, name), tokens);
    if (conflict) return { error: SIZE_MESSAGES.exists(conflict.name) };
    if (input.kind === 'shadow') {
        return { request: { kind: 'shadow', name, layers: [{ ...DEFAULT_SHADOW_LAYER }], fallbackElevation: 0 } };
    }
    const error = validatePx(input.value, RANGES[input.kind]);
    if (error) return { error };
    return { request: { kind: input.kind, name, valuePx: parsePx(input.value) } };
};
