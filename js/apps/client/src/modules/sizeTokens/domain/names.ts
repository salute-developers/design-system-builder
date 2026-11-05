import { type SizeToken, type SizeTokenKind } from './types';

/** Правила имён `design.md`: токены вне правила в разделе не показываются. */
export const NAME_RULES: Record<SizeTokenKind, RegExp> = {
    radius: /^round\.[a-z0-9]+(-[a-z0-9]+)*$/,
    spacing: /^spacing\.[a-z0-9]+(-[a-z0-9]+)*$/,
    // Имя тени произвольное: `card`, `elevated.focus`, `down.soft.m`.
    shadow: /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)*$/,
};

export const NAME_PREFIX: Record<'radius' | 'spacing', string> = { radius: 'round.', spacing: 'spacing.' };

/** Раздел токена темы по типу и имени или `null`, если имя вне правила. */
export const kindOfThemeToken = (type: string, name: string): SizeTokenKind | null => {
    const kind = type === 'shape' ? 'radius' : type === 'spacing' ? 'spacing' : type === 'shadow' ? 'shadow' : null;
    return kind && NAME_RULES[kind].test(name) ? kind : null;
};

export const FULL_ROUNDING_NAME = 'round.circle';

/** Части имени тени: группа — всё до последней точки (`down.soft` у `down.soft.m`, пусто у `card`), размер — остальное. */
export const shadowParts = (name: string) => {
    const dot = name.lastIndexOf('.');
    return { group: dot < 0 ? '' : name.slice(0, dot), size: dot < 0 ? name : name.slice(dot + 1) };
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** Подпись размера: `m` → `M`, `xxl` → `XXL`, остальное как есть. */
export const sizeLabel = (size: string) => (/^x*[sml]$/.test(size) ? size.toUpperCase() : size);

/** Подпись группы теней по началу имени: `down.soft` → «Down Soft». */
export const groupLabel = (group: string) => group.split('.').map(capitalize).join(' ');

/** Короткое имя токена в дереве и на борде: «M», «Circle», «4x», «Down Soft S», «Card». */
export const shortName = (token: Pick<SizeToken, 'kind' | 'name'>) => {
    if (token.kind === 'shadow') {
        const { group, size } = shadowParts(token.name);
        return [group && groupLabel(group), group ? sizeLabel(size) : capitalize(size)].filter(Boolean).join(' ');
    }
    const name = token.name.replace(/^(round|spacing)\./, '');
    return name === 'circle' ? 'Circle' : sizeLabel(name);
};

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

/** Порядок строк раздела: радиусы и отступы — по значению, полное скругление последним; тени — по группе, затем по размеру. */
export const compareTokens = (a: SizeToken, b: SizeToken): number => {
    if (a.kind === 'shadow' && b.kind === 'shadow') {
        const left = shadowParts(a.name);
        const right = shadowParts(b.name);
        // Тени без группы (`card`) — после групп.
        return (
            Number(!left.group) - Number(!right.group) ||
            left.group.localeCompare(right.group) ||
            compareSizes(left.size, right.size)
        );
    }
    const value = (token: SizeToken) =>
        token.kind === 'shadow' || token.fullRounding || token.valuePx === null ? Infinity : token.valuePx;
    return value(a) - value(b) || a.name.localeCompare(b.name);
};

/** Правимая часть имени: у радиуса и отступа — после `round.` / `spacing.`, у тени — имя целиком. */
export const editableName = (token: Pick<SizeToken, 'kind' | 'name'>) =>
    token.kind === 'shadow' ? token.name : token.name.slice(NAME_PREFIX[token.kind].length);

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

/** Имя новой тени из ввода: части через точку, каждая — как `normalizeTokenName`; пустые части отбрасываются. */
export const normalizeShadowName = (input: string) =>
    input.split('.').map(normalizeTokenName).filter(Boolean).join('.');

/**
 * Ключ переменной тени в пакете: генератор заменяет точки дефисами, поэтому `down.soft.m` и `down-soft-m` дают одну
 * переменную и вместе быть не могут.
 */
export const shadowVariableKey = (name: string) => name.replace(/\./g, '-');

/** Имя отступа по правилу темы `Nx = N × 2 px`: 28 → `14x`; для нечётного или неверного значения — пусто. */
export const spacingNameFromValue = (raw: string) => {
    const text = raw.trim();
    if (!/^\d+$/.test(text)) return '';
    const value = Number(text);
    return value % 2 === 0 ? `${value / 2}x` : '';
};
