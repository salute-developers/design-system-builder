import {
    cssPx,
    kindOfThemeToken,
    newShadowVariants,
    parseCssLayer,
    shadowParts,
    SHADOW_VARIANTS,
    tokenValue,
    type CreateSizeTokenRequest,
    type ShadowLayer,
    type SizeToken,
    type SizeTokenKind,
} from '../domain';
import type { PendingUpdate } from './autosave';

/** Запись прежнего черновика: полное имя и тип токена темы. */
export interface LegacyDraftEntry {
    name: string;
    type: string;
}

/** Значение платформы записи черновика: модель темы с наложенным черновиком. */
export type DraftValue = (name: string, type: string, platform: 'web' | 'android') => unknown;

/** Записи радиусов, отступов и теней с именем по правилу раздела. */
export const legacySizeEntries = <T extends LegacyDraftEntry>(entries: readonly T[]) =>
    entries.filter((entry) => kindOfThemeToken(entry.type, entry.name) !== null);

/** Операции переноса черновика: изменения существующих токенов и создание токенов, которых нет на сервере. */
export interface LegacyDraftOperations {
    updates: PendingUpdate[];
    creates: CreateSizeTokenRequest[];
}

const draftLayers = (value: unknown): ShadowLayer[] =>
    ([] as unknown[])
        .concat(value ?? [])
        .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
        .map(parseCssLayer);

const draftElevation = (value: unknown, fallback: number) => {
    const first = Array.isArray(value) ? (value[0] as { fallbackElevation?: unknown } | undefined) : undefined;
    return typeof first?.fallbackElevation === 'number' ? first.fallbackElevation : fallback;
};

const draftPx = (value: unknown) => Math.round(cssPx(String(Array.isArray(value) ? value[0] : (value ?? ''))));

/**
 * Записи черновика переводятся через значения на вебе: радиус и отступ — в px, тень — в слои; запасная высота —
 * из Android. Свои значения платформ существующих токенов сохраняются. Тень, которой нет на сервере, создаётся
 * размером целиком: варианты без записи черновика получают слои самого крупного размера варианта.
 */
export const legacyDraftOperations = (
    entries: readonly LegacyDraftEntry[],
    tokens: readonly SizeToken[],
    value: DraftValue,
): LegacyDraftOperations => {
    const byName = new Map(tokens.map((token) => [token.name, token]));
    const updates: PendingUpdate[] = [];
    const creates: CreateSizeTokenRequest[] = [];
    const newShadowSizes = new Set<string>();

    for (const entry of legacySizeEntries(entries)) {
        const kind = kindOfThemeToken(entry.type, entry.name) as SizeTokenKind;
        const token = byName.get(entry.name);
        const web = value(entry.name, entry.type, 'web');
        if (token) {
            const current = tokenValue(token);
            if (!current) continue;
            if (current.kind === 'dimension')
                updates.push({ tokenId: token.tokenId, value: { ...current, valuePx: draftPx(web) } });
            else
                updates.push({
                    tokenId: token.tokenId,
                    value: {
                        ...current,
                        layers: draftLayers(web),
                        fallbackElevation: draftElevation(
                            value(entry.name, entry.type, 'android'),
                            current.fallbackElevation,
                        ),
                    },
                });
            continue;
        }
        if (kind === 'shadow') {
            const { size } = shadowParts(entry.name);
            // Размер, часть вариантов которого уже есть на сервере, создать нельзя: имена заняты.
            if (!tokens.some((item) => item.kind === 'shadow' && shadowParts(item.name).size === size))
                newShadowSizes.add(size);
            continue;
        }
        creates.push({ kind, name: entry.name.replace(/^(round|spacing)\./, ''), valuePx: draftPx(web) });
    }

    const drafted = new Set(legacySizeEntries(entries).map((entry) => entry.name));
    for (const size of newShadowSizes) {
        const fallback = newShadowVariants(tokens);
        creates.push({
            kind: 'shadow',
            name: size,
            variants: SHADOW_VARIANTS.map((variant, index) => {
                const name = `${variant}.${size}`;
                if (!drafted.has(name)) return fallback[index];
                const layers = draftLayers(value(name, 'shadow', 'web'));
                return layers.length
                    ? { variant, layers, fallbackElevation: draftElevation(value(name, 'shadow', 'android'), 0) }
                    : fallback[index];
            }),
        });
    }
    return { updates, creates };
};
