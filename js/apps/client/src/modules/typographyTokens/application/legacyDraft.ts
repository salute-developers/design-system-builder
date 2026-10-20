import {
    styleKey,
    type TypographyScreen,
    type TypographyStyleChange,
    type TypographyStyles,
    type TypographyVariant,
} from '../domain';

/** Запись прежнего черновика: полное имя токена и значения платформ. */
export interface LegacyTypographyEntry {
    name: string;
    values: { web?: unknown };
}

/** Правка стиля из записей черновика одного стиля на одном экране. */
export interface LegacyTypographyChange {
    /** Ключ очереди `<экран>|<стиль>`. */
    key: string;
    tokenId: string;
    change: TypographyStyleChange;
    /** Имена записей черновика, из которых собрана правка. */
    names: string[];
}

/** Число стилей экрана, у которых в черновике есть записи типографии. */
export const legacyStyleCount = (entries: readonly LegacyTypographyEntry[]) =>
    new Set(entries.map((entry) => entry.name.replace(/\.(normal|medium|bold)$/, ''))).size;

const NAME = /^(screen-[sml])\.([a-z]+)\.([a-z0-9]+)\.(normal|medium|bold)$/;
const VARIANT_ORDER: TypographyVariant[] = ['normal', 'medium', 'bold'];

const record = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

/** Длина на вебе в px: `1.25rem` → 20, `20px` → 20. */
const px = (value: unknown) => {
    const text = String(value ?? '').trim();
    const number = parseFloat(text);
    if (!Number.isFinite(number)) return undefined;
    return text.endsWith('rem') ? number * 16 : number;
};

const em = (value: unknown) => {
    const text = String(value ?? '').trim();
    if (text === 'normal') return 0;
    const number = parseFloat(text);
    return Number.isFinite(number) ? number : undefined;
};

const weight = (value: unknown) => {
    const text = String(value ?? '').trim();
    if (text === 'normal') return 400;
    if (text === 'bold') return 700;
    const number = Number(text);
    return Number.isFinite(number) ? number : undefined;
};

const defined = <T extends object>(value: T) =>
    Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;

/**
 * Правки стилей из записей типографии прежнего черновика: значения берутся из веба, размеры — у первого по
 * порядку начертания, веса — у каждого начертания. Записи токенов вне правила стиля или стилей, которых нет в
 * теме, пропускаются.
 */
export const legacyTypographyChanges = (
    entries: readonly LegacyTypographyEntry[],
    styles: TypographyStyles,
): LegacyTypographyChange[] => {
    const grouped = new Map<
        string,
        Array<{ variant: TypographyVariant; name: string; web: Record<string, unknown> }>
    >();
    for (const entry of entries) {
        const match = NAME.exec(entry.name);
        if (!match) continue;
        const [, screen, group, size, variant] = match;
        const key = `${screen}|${group}.${size}`;
        grouped.set(key, [
            ...(grouped.get(key) ?? []),
            { variant: variant as TypographyVariant, name: entry.name, web: record(entry.values.web) },
        ]);
    }
    const changes: LegacyTypographyChange[] = [];
    for (const [key, members] of grouped) {
        const [screen, style] = key.split('|') as [TypographyScreen, string];
        const target = styles.screens
            .find((item) => item.screen === screen)
            ?.styles.find((item) => styleKey(item) === style);
        const tokenId = target && Object.values(target.variants).find(Boolean)?.tokenId;
        if (!target || !tokenId) continue;
        const ordered = [...members].sort(
            (a, b) => VARIANT_ORDER.indexOf(a.variant) - VARIANT_ORDER.indexOf(b.variant),
        );
        const base = ordered[0].web;
        const weights = defined(
            Object.fromEntries(ordered.map((member) => [member.variant, weight(member.web.fontWeight)])),
        ) as Partial<Record<TypographyVariant, number>>;
        const family = String(base.fontFamilyRef ?? '').replace(/^fontFamily\./, '');
        const change = defined<TypographyStyleChange>({
            size: px(base.fontSize),
            lineHeight: px(base.lineHeight),
            letterSpacing: em(base.letterSpacing),
            weights: Object.keys(weights).length ? weights : undefined,
            fontFamily: family || undefined,
        });
        changes.push({ key, tokenId, change, names: members.map((member) => member.name) });
    }
    return changes;
};
