import {
    TYPOGRAPHY_SCREENS,
    TYPOGRAPHY_VARIANTS,
    type TypographyOverride,
    type TypographyOverridePlatform,
    type TypographyScreen,
    type TypographyStyle,
    type TypographyStyleChange,
    type TypographyStyles,
    type TypographyValueAddress,
    type TypographyVariant,
} from './types';

/** Пары ключа и значения частичной записи; отсутствующие ключи пропускаются. */
export const definedEntries = <K extends string, V>(record: Partial<Record<K, V>> | undefined): Array<[K, V]> =>
    (Object.keys(record ?? {}) as K[])
        .map((key) => [key, record?.[key]] as [K, V | undefined])
        .filter((entry): entry is [K, V] => entry[1] !== undefined);

/** Группы прототипа в порядке дерева и борда. */
export const TYPOGRAPHY_GROUPS: ReadonlyArray<{ id: string; label: string }> = [
    { id: 'display', label: 'Display' },
    { id: 'header', label: 'Header' },
    { id: 'body', label: 'Body' },
    { id: 'text', label: 'Text' },
];

/** Образцы текста прототипа (`typographySampleText`). */
const SAMPLES: Record<string, string> = {
    display: 'Aa',
    header: 'Заголовок интерфейса',
    body: 'Съешь ещё этих мягких французских булок',
    text: 'Текстовый стиль интерфейса',
};

/** Начертание стиля для показа: выбранное, а если его у стиля нет — первое из имеющихся. */
export const styleVariant = (style: TypographyStyle, wanted: TypographyVariant): TypographyVariant =>
    style.variants[wanted] ? wanted : (TYPOGRAPHY_VARIANTS.find(({ id }) => style.variants[id])?.id ?? 'normal');

/** Веса в списке начертаний прототипа. */
export const TYPOGRAPHY_WEIGHTS: ReadonlyArray<{ value: number; label: string }> = [
    { value: 300, label: '300 / Light' },
    { value: 400, label: '400 / Regular' },
    { value: 500, label: '500 / Medium' },
    { value: 600, label: '600 / SemiBold' },
    { value: 700, label: '700 / Bold' },
    { value: 800, label: '800 / ExtraBold' },
];

/** Стиль по умолчанию при открытии раздела и при переключении на экран без выбранного стиля. */
export const DEFAULT_STYLE_KEY = 'body.m';

export const styleKey = (style: Pick<TypographyStyle, 'group' | 'size'>) => `${style.group}.${style.size}`;

export const groupLabel = (group: string) =>
    TYPOGRAPHY_GROUPS.find((item) => item.id === group)?.label ?? group.charAt(0).toUpperCase() + group.slice(1);

/** Название стиля: заголовки — `H1`, остальные — `Body M`. */
export const styleLabel = (style: Pick<TypographyStyle, 'group' | 'size'>) =>
    style.group === 'header' ? style.size.toUpperCase() : `${groupLabel(style.group)} ${style.size.toUpperCase()}`;

export const sampleText = (group: string) => SAMPLES[group] ?? 'Системный текстовый стиль';

export const screenLabel = (screen: TypographyScreen) =>
    TYPOGRAPHY_SCREENS.find((item) => item.id === screen)?.label ?? screen;

/** Стили экрана из ответа чтения. */
export const screenStyles = (styles: TypographyStyles | null, screen: TypographyScreen) =>
    styles?.screens.find((item) => item.screen === screen)?.styles ?? [];

/** Стили экрана по группам прототипа; группы вне прототипа — в конце в порядке появления. */
export const groupStyles = (styles: TypographyStyle[], query = '') => {
    const search = query.trim().toLowerCase();
    const known = TYPOGRAPHY_GROUPS.map((group) => group.id);
    const groups = [...known, ...new Set(styles.map((style) => style.group).filter((group) => !known.includes(group)))];
    return groups
        .map((group) => ({
            id: group,
            label: groupLabel(group),
            styles: styles.filter(
                (style) =>
                    style.group === group &&
                    (!search || `${groupLabel(group)} ${styleLabel(style)}`.toLowerCase().includes(search)),
            ),
        }))
        .filter((group) => group.styles.length > 0);
};

/** Объединяет правки одного стиля: поздние значения заменяют ранние, веса объединяются. */
export const mergeChanges = (first: TypographyStyleChange, next: TypographyStyleChange): TypographyStyleChange => ({
    ...first,
    ...next,
    ...(first.weights || next.weights ? { weights: { ...first.weights, ...next.weights } } : {}),
});

/** Свои значения без полей, которые совпадают с вебом: такое поле снова строится из веба. */
const normalizeOverrides = (style: TypographyStyle): TypographyStyle => {
    const overrides: NonNullable<TypographyStyle['overrides']> = {};
    definedEntries(style.overrides).forEach(([platform, override]) => {
        const differs = (value: number | undefined, base: number) =>
            value !== undefined && value !== base ? value : undefined;
        const weights = Object.fromEntries(
            definedEntries(override.weights).filter(([variant, weight]) => weight !== style.variants[variant]?.weight),
        ) as Partial<Record<TypographyVariant, number>>;
        const next: TypographyOverride = Object.fromEntries(
            Object.entries({
                sizePx: differs(override.sizePx, style.sizePx),
                lineHeightPx: differs(override.lineHeightPx, style.lineHeightPx),
                letterSpacingEm: differs(override.letterSpacingEm, style.letterSpacingEm),
                weights: Object.keys(weights).length ? weights : undefined,
            }).filter(([, value]) => value !== undefined),
        );
        if (Object.keys(next).length) overrides[platform] = next;
    });
    return { ...style, overrides };
};

/** Стиль после правки своего значения платформы: размеры — на экране правки, веса — на всех экранах. */
const applyPlatformChange = (
    style: TypographyStyle,
    change: TypographyStyleChange & { platform: TypographyOverridePlatform },
    screen: TypographyScreen,
): TypographyStyle => {
    const sameScreen = style.screen === screen;
    const current = style.overrides?.[change.platform] ?? {};
    const next: TypographyOverride = {
        ...current,
        ...(sameScreen && change.size !== undefined ? { sizePx: change.size } : {}),
        ...(sameScreen && change.lineHeight !== undefined ? { lineHeightPx: change.lineHeight } : {}),
        ...(sameScreen && change.letterSpacing !== undefined ? { letterSpacingEm: change.letterSpacing } : {}),
        ...(change.weights ? { weights: { ...current.weights, ...change.weights } } : {}),
    };
    return normalizeOverrides({ ...style, overrides: { ...style.overrides, [change.platform]: next } });
};

/** Стиль после правки [change] на экране [screen]: размеры меняются только на нём, веса и семейство — везде. */
export const applyChange = (
    style: TypographyStyle,
    change: TypographyStyleChange,
    screen: TypographyScreen,
): TypographyStyle => {
    if (change.platform) return applyPlatformChange(style, { ...change, platform: change.platform }, screen);
    const sameScreen = style.screen === screen;
    const variants = { ...style.variants };
    definedEntries(change.weights).forEach(([variant, weight]) => {
        const current = variants[variant];
        if (current) variants[variant] = { ...current, weight };
    });
    // Своё значение платформы правка веба не меняет; совпавшее с новым вебом снова строится из веба.
    return normalizeOverrides({
        ...style,
        sizePx: sameScreen && change.size !== undefined ? change.size : style.sizePx,
        lineHeightPx: sameScreen && change.lineHeight !== undefined ? change.lineHeight : style.lineHeightPx,
        letterSpacingEm:
            sameScreen && change.letterSpacing !== undefined ? change.letterSpacing : style.letterSpacingEm,
        fontFamily: change.fontFamily ?? style.fontFamily,
        variants,
    });
};

/** Стили темы после правки стиля [key] на экране [screen]. */
export const applyStyleChange = (
    styles: TypographyStyles,
    key: string,
    screen: TypographyScreen,
    change: TypographyStyleChange,
): TypographyStyles => ({
    ...styles,
    screens: styles.screens.map((item) => ({
        ...item,
        styles: item.styles.map((style) => (styleKey(style) === key ? applyChange(style, change, screen) : style)),
    })),
});

/**
 * Стили темы после ответа изменения [change]: стиль на экране ответа заменяется, изменённые веса и семейство
 * переносятся на стиль других экранов — сервер записал их на всех экранах.
 */
export const applyUpdatedStyle = (
    styles: TypographyStyles,
    updated: TypographyStyle,
    change: TypographyStyleChange,
): TypographyStyles => {
    const key = styleKey(updated);
    const weights = change.platform
        ? change.weights
        : (Object.fromEntries(
              definedEntries(updated.variants)
                  .filter(([variant]) => change.weights?.[variant] !== undefined)
                  .map(([variant, view]) => [variant, view.weight]),
          ) as Partial<Record<TypographyVariant, number>>);
    const fontFamily = change.fontFamily !== undefined ? updated.fontFamily : undefined;
    return {
        ...styles,
        screens: styles.screens.map((item) => ({
            ...item,
            styles: item.styles.map((style) => {
                if (styleKey(style) !== key) return style;
                // Использование в компонентах ответ изменения не несёт: оно от правки не меняется.
                if (style.screen === updated.screen) return { ...updated, components: style.components };
                return applyChange(style, { weights, fontFamily, platform: change.platform }, updated.screen);
            }),
        })),
    };
};

/** Значения стиля [key] на всех экранах: их технические редакции — базовые редакции правки стиля. */
export const styleValueAddresses = (styles: TypographyStyles | null, key: string): TypographyValueAddress[] =>
    (styles?.screens ?? []).flatMap((item) =>
        item.styles
            .filter((style) => styleKey(style) === key)
            .flatMap((style) =>
                definedEntries(style.variants).flatMap(([, variant]) =>
                    (variant.valueRevisions ?? []).map(({ platform }) => ({ tokenId: variant.tokenId, platform })),
                ),
            ),
    );

/** Технические редакции всех значений токенов стилей из ответа чтения. */
export const styleValueRevisions = (styles: TypographyStyles) =>
    styles.screens.flatMap((item) =>
        item.styles.flatMap((style) =>
            definedEntries(style.variants).flatMap(([, variant]) =>
                (variant.valueRevisions ?? []).map((value) => ({ tokenId: variant.tokenId, ...value })),
            ),
        ),
    );

/** Экран и стиль токена `<экран>.<группа>.<размер>.<начертание>` или `null` вне правила стиля. */
export const parseStyleTokenName = (name: string): { screen: TypographyScreen; key: string } | null => {
    const match = /^(screen-[sml])\.([a-z]+)\.([a-z0-9]+)\.(normal|medium|bold)$/.exec(name);
    return match ? { screen: match[1] as TypographyScreen, key: `${match[2]}.${match[3]}` } : null;
};

/** Число без лишних знаков для поля ввода. */
export const formatNumber = (value: number) => String(Number(value.toFixed(4)));

/** Число из поля ввода: запятая допускается как разделитель; `null` — не число. */
export const parseNumber = (raw: string): number | null => {
    const text = raw.trim().replace(',', '.');
    if (!text) return null;
    const value = Number(text);
    return Number.isFinite(value) ? value : null;
};
