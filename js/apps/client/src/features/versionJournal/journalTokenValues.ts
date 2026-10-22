import type { VariationType } from '../../controllers/themeBuilder/types/token';

const rounded = (value: number) => {
    return Number(value.toFixed(4));
};

/** Массивы тоже имеют адресуемые поля, но null и примитивы — нет. */
export const journalObject = (value: unknown): Record<string, unknown> | undefined => {
    if (value === null || typeof value !== 'object') return undefined;
    return value as Record<string, unknown>;
};

/** Изменение состава или порядка слоёв нельзя безопасно отменять по отдельным индексам. */
export const journalValueStructureChanged = (previous: unknown, current: unknown): boolean => {
    if (Array.isArray(previous) || Array.isArray(current)) {
        if (!Array.isArray(previous) || !Array.isArray(current) || previous.length !== current.length) return true;
        const serialized = current.map((value) => JSON.stringify(value));
        return previous.some((value, index) => {
            const encoded = JSON.stringify(value);
            const same = encoded === serialized[index];
            const moved = !same && serialized.some((candidate, other) => other !== index && candidate === encoded);
            return moved || journalValueStructureChanged(value, current[index]);
        });
    }
    const before = journalObject(previous);
    const after = journalObject(current);
    if (Boolean(before) !== Boolean(after)) return true;
    if (!before || !after) return false;
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    return [...keys].some((key) => journalValueStructureChanged(before[key], after[key]));
};

const editorLength = (value: unknown) => {
    if (typeof value !== 'string') return value;
    const match = /^(-?\d+(?:\.\d+)?)(rem|px)?$/.exec(value);
    if (!match) return value;
    const unitScale = match[2] === 'rem' ? 16 : 1;
    return rounded(Number(match[1]) * unitScale);
};

const editorShadow = (value: unknown) => {
    if (typeof value !== 'string') return value;
    const match = /^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.+)$/.exec(value.trim());
    if (!match) return value;
    return {
        offsetX: editorLength(match[1]),
        offsetY: editorLength(match[2]),
        blur: editorLength(match[3]),
        spread: editorLength(match[4]),
        color: match[5],
    };
};

const editorLetterSpacing = (value: unknown) => {
    if (value === 'normal') return 0;
    if (typeof value !== 'string') return value;
    if (!/^-?\d+(?:\.\d+)?em$/.test(value)) return value;
    return rounded(parseFloat(value) * 16);
};

const typographyConverters = new Map<string, (value: unknown) => unknown>([
    ['fontSize', editorLength],
    ['lineHeight', editorLength],
    ['letterSpacing', editorLetterSpacing],
]);

const editorTypography = (value: unknown) => {
    if (Array.isArray(value)) return value;
    const typography = journalObject(value);
    if (!typography) return value;
    return Object.fromEntries(
        Object.entries(typography).map(([key, parameter]) => {
            const convert = typographyConverters.get(key);
            return [key, convert ? convert(parameter) : parameter];
        }),
    );
};

const valueConverters = new Map<VariationType, (value: unknown) => unknown>([
    ['shadow', (value) => (Array.isArray(value) ? value.map(editorShadow) : editorShadow(value))],
    ['shape', editorLength],
    ['spacing', editorLength],
    ['typography', editorTypography],
]);

/** Возвращает числа и параметры редактора; массивы слоёв не разворачиваются. */
export const journalTokenValue = (value: unknown, type?: VariationType): unknown => {
    if (type !== 'shadow' && type !== 'gradient' && Array.isArray(value) && value.length === 1) {
        return journalTokenValue(value[0], type);
    }
    if (!type) return value;
    const convert = valueConverters.get(type);
    if (convert) return convert(value);
    return value;
};
