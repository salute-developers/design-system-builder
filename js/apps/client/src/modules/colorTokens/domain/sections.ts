import type { ColorSection, ColorTokenKey } from './types';

/** Разделы дерева и их подписи в порядке прототипа. */
export const SECTION_ORDER: readonly ColorSection[] = [
    'text',
    'surface',
    'outline',
    'background',
    'overlay',
    'data',
    'technical',
];

export const SECTION_LABELS: Record<ColorSection, string> = {
    text: 'Text & Icons',
    surface: 'Surfaces',
    outline: 'Outlines',
    background: 'BG',
    overlay: 'Overlays',
    data: 'Data',
    technical: 'Technical',
};

/** Префикс отображаемого имени раздела, как у токенов сидов: `textAccent`, `surfaceAccent`. */
const GROUP_OF_SECTION: Record<Exclude<ColorSection, 'technical'>, string> = {
    text: 'text',
    surface: 'surface',
    outline: 'outline',
    background: 'background',
    overlay: 'overlay',
    data: 'data',
};

/** Группа определений, в которую создаётся новый токен раздела. */
export const sectionGroup = (section: ColorSection) =>
    section === 'technical' ? 'surface' : GROUP_OF_SECTION[section];

/** Раздел дерева по группе токена; служебные `read-only` — в разделе Technical. */
export const sectionOf = (key: ColorTokenKey): ColorSection | null => {
    if (key.name === 'read-only') return 'technical';
    const known = SECTION_ORDER.find((section) => section !== 'technical' && GROUP_OF_SECTION[section] === key.group);
    return known ?? null;
};

const DEFAULT_CATEGORY_SECTIONS = new Set<ColorSection>(['background', 'overlay', 'data', 'technical']);
const SOLID_TRANSPARENT_SECTIONS = new Set<ColorSection>(['surface', 'outline']);

/** Подпись категории по группе палитры: системные группы в терминах прототипа, пользовательские — своим именем. */
export const paletteCategoryLabel = (systemKey: string | null, label: string) => {
    if (systemKey === 'neutral') return 'General';
    if (systemKey === 'accent') return 'Accent';
    if (systemKey === 'status') return 'Status';
    return label;
};

/** Solid или Transparent по имени токена Surfaces и Outlines. */
export const surfaceKind = (name: string) =>
    name.startsWith('transparent-') || name === 'clear' ? 'Transparent' : 'Solid';

/** Категория на борде: группа палитры, для Surfaces и Outlines — с Solid или Transparent; для BG и др. — Default. */
export const categoryOf = (key: ColorTokenKey, section: ColorSection, paletteCategory: string | null) => {
    if (DEFAULT_CATEGORY_SECTIONS.has(section)) return 'Default';
    const base = paletteCategory ?? 'General';
    return SOLID_TRANSPARENT_SECTIONS.has(section) ? `${base} / ${surfaceKind(key.name)}` : base;
};
