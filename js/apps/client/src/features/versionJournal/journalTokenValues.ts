import { getRestoredColorFromPalette } from '@salutejs/plasma-tokens-utils';
import { normalizedColorValue } from '../../api/colorValue';
import type { VariationType } from '../../controllers/themeBuilder/types/token';
import {
    colorField,
    fieldText,
    GRADIENT_TYPE_LABELS,
    readPaint,
    type Paint,
    type PaintPlatform,
} from '../../modules/colorTokens/domain';
import type { JournalChangedField, JournalValue } from './journalFields';

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

/** Цвет свотча: CSS-цвет как есть, ссылка — по шаблонной палитре, градиент — его CSS с раскрытыми ссылками. */
export const journalColor = (value: JournalValue): string | undefined => {
    if (value && typeof value === 'object') return value.swatch;
    value = normalizedColorValue(value);
    if (typeof value !== 'string') return undefined;
    const color = value.trim();
    if (/^(?:#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})|(?:rgba?|hsla?)\([\d\s.,%/+\-]+\))$/i.test(color)) return color;
    if (/^\[(?:general|additional)\.[a-zA-Z]+\.\d+\](?:\[\d+(?:\.\d+)?\])?$/.test(color)) {
        try {
            return getRestoredColorFromPalette(color);
        } catch {
            return undefined;
        }
    }
    return undefined;
};

/** Хранимое значение платформы цветового токена из записи журнала. */
export interface JournalPaintSource {
    value: unknown;
    platform: PaintPlatform;
}

/** Параметры градиента под названиями редактора; геометрия другого типа не показывается. */
const gradientParameters = ({ model }: Extract<Paint, { kind: 'gradient' }>) => {
    const [angle, from, centerX, centerY, radius] = [
        model.angle,
        model.from,
        model.centerX,
        model.centerY,
        model.radius,
    ].map((value) => Number(value.toFixed(3)));
    const center: [string, string] = ['Центр', `${centerX}% · ${centerY}%`];
    const geometry: Record<typeof model.type, Array<[string, string]>> = {
        linear: [['Угол', `${angle}°`]],
        radial: [center, ['Радиус', `${radius}%`]],
        conic: [center, ['Начальный угол', `${from}°`]],
    };
    return new Map<string, JournalValue>([
        ['Тип', GRADIENT_TYPE_LABELS[model.type]],
        ...geometry[model.type],
        ...model.stops.flatMap(
            (stop, index): Array<[string, string]> => [
                [`Стоп ${index + 1} · цвет`, stop.color],
                [`Стоп ${index + 1} · позиция`, `${Number(stop.position.toFixed(3))}%`],
            ],
        ),
    ]);
};

/** Названия редактора для полей слоя платформы по пути `/value/<слой>/<поле>[/<стоп>]`. */
const layerFieldLabels: Record<string, string> = {
    angle: 'Угол',
    centerX: 'Центр',
    centerY: 'Центр',
    radius: 'Радиус',
    endRadius: 'Радиус',
    startAngle: 'Начальный угол',
    endAngle: 'Начальный угол',
    colors: 'цвет',
    locations: 'позиция',
};

/** Сменились ли вид значения, тип градиента или число стопов: такую запись отменяют только целиком. */
export const journalPaintStructureChanged = (previous?: JournalPaintSource, current?: JournalPaintSource) => {
    const [before, after] = [previous, current]
        .map((source) => source && readPaint(source.value, source.platform))
        .map(
            (paint) =>
                paint && (paint.kind === 'gradient' ? `${paint.model.type}:${paint.model.stops.length}` : 'color'),
        );
    return Boolean(before && after) && before !== after;
};

/**
 * Изменение значения цветового токена в терминах поля инспектора: цвет — ссылкой или HEX, градиент — подписью
 * «Линейный · 45°» и свотчем, смена вида — «Вид значения», у двух градиентов — строки изменённых параметров и стопов.
 * Строка получает пути отмены из [valuePaths] — изменённых путей хранимого значения: единственная строка — все,
 * параметр слоя платформы — пути своих полей; у web слой — одна CSS-строка, и параметр без своего пути отменяется
 * только вместе с записью. `null` — одно из значений не цвет и не градиент.
 */
export const journalPaintChange = (
    previous?: JournalPaintSource,
    current?: JournalPaintSource,
    valuePaths: string[] = [],
): JournalChangedField[] | null => {
    const [before, after] = [previous, current].map((source) => source && readPaint(source.value, source.platform));
    if ([before, after].includes(null)) return null;
    if (before?.kind === 'gradient' && after?.kind === 'gradient') {
        const [was, now] = [before, after].map(gradientParameters);
        const labels = [...new Set([...was.keys(), ...now.keys()])].filter(
            (label) => was.get(label) !== now.get(label),
        );
        return labels.map((label) => ({
            path: `/value/${label}`,
            label,
            before: was.get(label),
            after: now.get(label),
            revertPaths:
                labels.length === 1
                    ? valuePaths
                    : valuePaths.filter((path) => {
                          const [, , layer, field, stop] = path.split('/');
                          const name = layerFieldLabels[field];
                          return (
                              layer === String(after.index) &&
                              (stop ? `Стоп ${Number(stop) + 1} · ${name}` : name) === label
                          );
                      }),
        }));
    }
    // Значение как в поле инспектора: цвет — ссылкой или HEX, градиент — подписью и свотчем.
    const [was, now] = [
        { paint: before, source: previous },
        { paint: after, source: current },
    ].map(({ paint, source }): JournalValue => {
        if (paint?.kind !== 'gradient') return paint?.color;
        const field = colorField(
            source?.value,
            '',
            (color) => journalColor(color) ?? null,
            undefined,
            source?.platform,
        );
        return { text: fieldText(field), swatch: field.resolved };
    });
    if (JSON.stringify(was) === JSON.stringify(now)) return [];
    const kinds = new Set([before?.kind, after?.kind].filter(Boolean));
    const label = kinds.size > 1 ? 'Вид значения' : kinds.has('color') ? 'Цвет' : 'Значение';
    return [{ path: '/value', label, before: was, after: now, revertPaths: valuePaths }];
};
