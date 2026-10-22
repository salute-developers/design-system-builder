import { formatPaletteReference, parsePaletteReference } from '../../palette';

export type GradientType = 'linear' | 'radial' | 'conic';
export type ValueKind = 'color' | 'gradient';

/** Стоп градиента: цвет — HEX (`#RRGGBB` или `#RRGGBBAA`) или ссылка `[type.shade.step][o]`, позиция 0–100. */
export interface GradientStopModel {
    color: string;
    position: number;
}

/**
 * Модель одного слоя градиента: угол Linear, начальный угол Conic, центр Radial и Conic в процентах, радиус
 * Radial в процентах. Поля другого типа хранят значения по умолчанию, чтобы смена типа их не теряла.
 */
export interface GradientModel {
    type: GradientType;
    angle: number;
    from: number;
    centerX: number;
    centerY: number;
    radius: number;
    stops: GradientStopModel[];
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const STOP_HEX = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i;
const SIGNED = String.raw`-?\d+(?:\.\d+)?`;
const UNSIGNED = String.raw`\d+(?:\.\d+)?`;
const FUNCTION = /^\s*(linear|radial|conic)-gradient\((.*)\)\s*$/s;
const LINEAR = new RegExp(`^(${SIGNED})deg$`);
const RADIAL = new RegExp(`^(${UNSIGNED})%\\s+(${UNSIGNED})%\\s+at\\s+(${UNSIGNED})%\\s+(${UNSIGNED})%$`);
const CONIC = new RegExp(`^from\\s+(${SIGNED})deg\\s+at\\s+(${UNSIGNED})%\\s+(${UNSIGNED})%$`);
const STOP = new RegExp(
    String.raw`^(#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?|\[[^\]\s]+](?:\[[^\]\s]+])?)\s+(${UNSIGNED})%$`,
);

/** Значения геометрии по умолчанию: Linear 90°, центр 50 % / 50 %, радиус 50 %, начальный угол 0°. */
export const GRADIENT_DEFAULTS = { angle: 90, from: 0, centerX: 50, centerY: 50, radius: 50 } as const;

/** Является ли строка цветом: HEX `#RGB`, `#RRGGBB`, `#RRGGBBAA` или ссылкой на ступень палитры. */
export const isColorString = (value: string) => HEX.test(value.trim()) || parsePaletteReference(value) !== null;

/** Записан ли слой градиентной функцией `linear`, `radial` или `conic`, даже с ошибкой внутри. */
export const isGradientFunction = (layer: string) => FUNCTION.test(layer);

/**
 * Разбор web-слоя по грамматике `ds-service`: `linear-gradient(<a>deg, …)`, `radial-gradient(<r>% <r>% at <x>%
 * <y>%, …)` и `conic-gradient(from <a>deg at <x>% <y>%, …)` со стопами `#RRGGBB`, `#RRGGBBAA` или ссылкой и
 * позицией `N%`; стопов не меньше двух, позиции не убывают и лежат от 0 до 100. `null` — слой не градиент.
 */
export const parseWebLayer = (layer: string): GradientModel | null => {
    const match = FUNCTION.exec(layer);
    if (!match) return null;
    // Как на сервере: стопы не содержат запятых, поэтому делятся по каждой запятой.
    const parts = match[2].split(',').map((part) => part.trim());
    const stops: GradientStopModel[] = [];
    for (const part of parts.slice(1)) {
        const stop = STOP.exec(part);
        if (!stop) return null;
        const color = stop[1];
        if (!STOP_HEX.test(color) && !parsePaletteReference(color)) return null;
        const position = Number(stop[2]);
        if (position > 100) return null;
        stops.push({ color: color.startsWith('#') ? color.toUpperCase() : color, position });
    }
    if (stops.length < 2 || stops.some((stop, index) => index > 0 && stop.position < stops[index - 1].position))
        return null;
    const head = parts[0];
    const model = { ...GRADIENT_DEFAULTS, stops };
    if (match[1] === 'linear') {
        const linear = LINEAR.exec(head);
        return linear ? { ...model, type: 'linear', angle: Number(linear[1]) } : null;
    }
    if (match[1] === 'radial') {
        const radial = RADIAL.exec(head);
        if (!radial) return null;
        const [radius, second, centerX, centerY] = radial.slice(1).map(Number);
        // Один радиус: иначе слой не строится для iOS и Android однозначно.
        if (radius !== second || centerX > 100 || centerY > 100) return null;
        return { ...model, type: 'radial', radius, centerX, centerY };
    }
    const conic = CONIC.exec(head);
    if (!conic) return null;
    const [from, centerX, centerY] = conic.slice(1).map(Number);
    if (centerX > 100 || centerY > 100) return null;
    return { ...model, type: 'conic', from, centerX, centerY };
};

/** CSS-слой модели в грамматике `ds-service`; стопы упорядочены по позиции. */
export const formatWebLayer = (model: GradientModel): string => {
    const stops = [...model.stops]
        .sort((a, b) => a.position - b.position)
        .map((stop) => `${stop.color} ${Number(Math.min(100, Math.max(0, stop.position)).toFixed(3))}%`)
        .join(', ');
    const [angle, from, centerX, centerY, radius] = [
        model.angle,
        model.from,
        model.centerX,
        model.centerY,
        model.radius,
    ].map((value) => Number(value.toFixed(3)));
    if (model.type === 'radial') return `radial-gradient(${radius}% ${radius}% at ${centerX}% ${centerY}%, ${stops})`;
    if (model.type === 'conic') return `conic-gradient(from ${from}deg at ${centerX}% ${centerY}%, ${stops})`;
    return `linear-gradient(${angle}deg, ${stops})`;
};

/**
 * Слои web-значения: массив строк или строка, которая делится по запятым верхнего уровня (запятые внутри
 * `rgba(...)` и `linear-gradient(...)` не делят).
 */
export const webLayers = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    if (value === undefined || value === null) return [];
    const text = String(value);
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        if (char === '(') depth += 1;
        else if (char === ')') depth = Math.max(0, depth - 1);
        else if (char === ',' && depth === 0) {
            parts.push(text.slice(start, index).trim());
            start = index + 1;
        }
    }
    parts.push(text.slice(start).trim());
    return parts.filter(Boolean);
};

/**
 * Вид web-значения: цвет — один слой-цвет, градиент — хотя бы один слой-градиент по грамматике при остальных
 * слоях-цветах; `null` — значение не цвет и не градиент.
 */
export const valueKind = (web: string[]): ValueKind | null => {
    if (web.length === 1 && isColorString(web[0])) return 'color';
    if (!web.length) return null;
    const gradients = web.filter((layer) => parseWebLayer(layer) !== null);
    if (!gradients.length) return null;
    return web.every((layer) => parseWebLayer(layer) !== null || isColorString(layer)) ? 'gradient' : null;
};

/** Цвет стопа в HEX для вычислений: HEX как есть, ссылка — через [resolve]. */
export type StopColorResolver = (color: string) => string | null;

/** `#RRGGBBAA` цвета: HEX дополняется альфой, ссылка остаётся ссылкой. */
export const hex8 = (color: string) => {
    let digits = color.slice(1);
    if (digits.length === 3 || digits.length === 4) digits = [...digits].map((char) => char + char).join('');
    if (digits.length === 6) digits += 'FF';
    return color.startsWith('#') && /^[0-9a-f]{8}$/i.test(digits) ? `#${digits.toUpperCase()}` : color;
};

/** Прозрачность цвета стопа 0–1: у ссылки — прозрачность ссылки, у HEX — альфа-канал. */
export const stopOpacity = (color: string) => {
    const reference = parsePaletteReference(color);
    if (reference) return reference.opacity ?? 1;
    const hex = hex8(color.trim());
    return /^#[0-9A-F]{8}$/.test(hex) ? parseInt(hex.slice(7), 16) / 255 : 1;
};

/** Цвет стопа с прозрачностью [opacity] (0–1): у ссылки — прозрачность ссылки, у HEX — альфа-канал (без него при 1). */
export const withStopOpacity = (color: string, opacity: number) => {
    const reference = parsePaletteReference(color);
    if (reference) return formatPaletteReference({ ...reference, opacity: opacity >= 1 ? null : opacity });
    const hex = hex8(color.trim());
    if (!/^#[0-9A-F]{8}$/.test(hex)) return color;
    const alpha = Math.round(Math.max(0, opacity) * 255)
        .toString(16)
        .padStart(2, '0')
        .toUpperCase();
    return opacity < 1 ? `${hex.slice(0, 7)}${alpha}` : hex.slice(0, 7);
};

/**
 * Цвет градиента в позиции [position] (0–100): стоп в этой позиции — как записан (ссылка сохраняется), иначе
 * интерполяция соседних стопов в `#RRGGBBAA`. Без раскрытия ссылки берётся ближайший стоп.
 */
export const gradientColorAt = (
    stops: GradientStopModel[],
    position: number,
    resolve: StopColorResolver = (color) => (color.startsWith('#') ? color : null),
): string => {
    const ordered = [...stops].sort((a, b) => a.position - b.position);
    if (!ordered.length) return '#000000FF';
    const exact = ordered.find((stop) => Math.abs(stop.position - position) < 1e-9);
    if (exact) return exact.color;
    if (position <= ordered[0].position) return ordered[0].color;
    const last = ordered[ordered.length - 1];
    if (position >= last.position) return last.color;
    const index = ordered.findIndex((stop) => stop.position > position);
    const [left, right] = [ordered[index - 1], ordered[index]];
    const t = (position - left.position) / (right.position - left.position || 1);
    // Каналы `#RRGGBBAA` раскрытых цветов соседних стопов; `null`, если цвет не раскрыт в HEX.
    const [a, b] = [left, right].map((stop) => {
        const hex = hex8(`#${resolve(stop.color)?.replace('#', '') ?? ''}`);
        return /^#[0-9A-F]{8}$/.test(hex) ? [1, 3, 5, 7].map((i) => parseInt(hex.slice(i, i + 2), 16)) : null;
    });
    if (!a || !b) return t < 0.5 ? left.color : right.color;
    const mixed = a.map((channel, i) => Math.round(channel + (b[i] - channel) * t));
    return `#${mixed
        .map((channel) => channel.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()}`;
};

/** Подпись поля градиентного значения: «Linear · 45°», «Radial», «Conic · 90°» и «+ ещё N» при нескольких слоях. */
export const gradientLabel = (model: GradientModel, layers = 1) => {
    const base =
        model.type === 'linear'
            ? `Linear · ${Number(model.angle.toFixed(3))}°`
            : model.type === 'radial'
              ? 'Radial'
              : `Conic · ${Number(model.from.toFixed(3))}°`;
    return layers > 1 ? `${base} + ещё ${layers - 1}` : base;
};

/** Модель с другим типом: стопы и геометрия сохраняются, недостающая геометрия — по умолчанию. */
export const withGradientType = (model: GradientModel, type: GradientType): GradientModel => ({ ...model, type });
