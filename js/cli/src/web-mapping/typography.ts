/** Поля типографики ядра. */
export const TYPOGRAPHY_PARTS = ['fontFamily', 'fontWeight', 'fontStyle', 'fontSize', 'lineHeight', 'letterSpacing'] as const;

export type TypographyPart = (typeof TYPOGRAPHY_PARTS)[number];

const isTypographyPart = (value: string): value is TypographyPart => (TYPOGRAPHY_PARTS as readonly string[]).includes(value);

/**
 * Поле типографики параметра ядра: `part` меты, а без него — поле, имя которого входит в имя параметра без учёта
 * регистра (`buttonFontSize` → `fontSize`, `typoFontLetterSpacing` → `letterSpacing`).
 */
export const typographyPartFor = (paramName: string, part?: string): TypographyPart | undefined => {
    if (part && isTypographyPart(part)) return part;
    const name = paramName.toLowerCase();
    return TYPOGRAPHY_PARTS.find((item) => name.includes(item.toLowerCase()));
};

/** Начало имени переменной системной группы: `display` → `dspl`, `header` опускается (`h1-bold`). */
const GROUP_PREFIX: Readonly<Record<string, string>> = { display: 'dspl', text: 'text', body: 'body', header: '' };

/** Вес в имени переменной: `normal` опускается. */
const WEIGHT_SUFFIX: Readonly<Record<string, string>> = { bold: 'bold', medium: 'medium', normal: '' };

/**
 * Основа имени переменных типографики темы `--plasma-typo-<основа>-<поле>` по идентификатору стиля без экрана, как в
 * `@salutejs/plasma-typo`: `header.h1.bold` → `h1-bold`, `display.l.normal` → `dspl-l`, `text.m.medium` → `text-m-medium`.
 * Своя группа идёт как есть; поиск только по собственным ключам, чтобы группа `constructor` не нашла `Object.prototype`.
 */
export const typographyVariableBase = (tokenId: string): string => {
    const parts = tokenId.split('.');
    parts[0] = Object.hasOwn(GROUP_PREFIX, parts[0]) ? GROUP_PREFIX[parts[0]] : parts[0];
    if (parts.length > 2) parts[2] = Object.hasOwn(WEIGHT_SUFFIX, parts[2]) ? WEIGHT_SUFFIX[parts[2]] : '';
    return parts.filter(Boolean).join('-');
};
