import {
    GRADIENT_DEFAULTS,
    gradientColorAt,
    hex8,
    isColorString,
    parseWebLayer,
    webLayers,
    type GradientModel,
    type GradientStopModel,
    type StopColorResolver,
} from './gradient';

export type NativePlatform = 'ios' | 'android';
export const NATIVE_PLATFORMS: readonly NativePlatform[] = ['ios', 'android'];

/** Слой значения iOS или Android: `linear`, `radial`, `angular` или `color`. */
export interface NativeLayer {
    kind: string;
    [field: string]: unknown;
}

/**
 * Стопы Android для Conic с начальным углом [from]: в слое `angular` угла нет, поэтому стопы сдвигаются по кругу
 * на `from / 360`, а на шов в позиции 0 и 1 ставится цвет градиента в точке `1 − from / 360`.
 */
export const rotatedConicStops = (
    stops: GradientStopModel[],
    from: number,
    resolve?: StopColorResolver,
): GradientStopModel[] => {
    const shift = (((from % 360) + 360) % 360) / 360;
    const ordered = [...stops].sort((a, b) => a.position - b.position);
    if (shift === 0) return ordered;
    const moved = ordered.map((stop) => {
        const position = stop.position / 100 + shift;
        return { color: stop.color, position: position >= 1 ? position - 1 : position, wrapped: position >= 1 };
    });
    // Перенесённые за шов стопы идут первыми: так порядок не нарушается и резкий переход в точке `from` сохраняется.
    const around = [...moved.filter((stop) => stop.wrapped), ...moved.filter((stop) => !stop.wrapped)];
    const seam = gradientColorAt(ordered, (1 - shift) * 100, resolve);
    return [
        { color: seam, position: 0 },
        ...around.map((stop) => ({ color: stop.color, position: Number((stop.position * 100).toFixed(6)) })),
        { color: seam, position: 100 },
    ];
};

/**
 * Слой платформы из модели. Conic на Android — без угла: с [rotate] стопы сдвигаются на начальный угол, без него
 * (своё значение платформы) остаются как есть.
 */
export const formatNativeLayer = (
    model: GradientModel,
    platform: NativePlatform,
    rotate = false,
    resolve?: StopColorResolver,
): NativeLayer => {
    const androidConic = model.type === 'conic' && platform === 'android';
    const stops = [...(androidConic && rotate ? rotatedConicStops(model.stops, model.from, resolve) : model.stops)];
    stops.sort((a, b) => a.position - b.position);
    const fields = {
        locations: stops.map((stop) => Number((stop.position / 100).toFixed(6))),
        colors: stops.map((stop) => hex8(stop.color)),
    };
    if (model.type === 'linear') return { kind: 'linear', ...fields, angle: model.angle };
    const [centerX, centerY, radius] = [model.centerX, model.centerY, model.radius].map((value) =>
        Number((value / 100).toFixed(6)),
    );
    if (model.type === 'radial')
        return platform === 'ios'
            ? { kind: 'radial', ...fields, centerX, centerY, startRadius: 0, endRadius: radius }
            : { kind: 'radial', ...fields, centerX, centerY, radius };
    if (androidConic) return { kind: 'angular', ...fields, centerX, centerY };
    return { kind: 'angular', ...fields, startAngle: model.from, endAngle: model.from + 360, centerX, centerY };
};

/**
 * Значение iOS или Android, построенное из web-значения (слои или строка): цвет — тот же цвет или ссылка (строка), градиент — массив слоёв
 * формата платформы, слой-цвет — `{ kind: "color", background }`. [resolve] раскрывает ссылки для цвета шва Conic.
 */
export const deriveNative = (
    value: unknown,
    platform: NativePlatform,
    resolve?: StopColorResolver,
): NativeLayer[] | string => {
    const web = webLayers(value);
    if (web.length === 1 && isColorString(web[0])) return web[0];
    return web.map((layer) => {
        const model = parseWebLayer(layer);
        if (model) return formatNativeLayer(model, platform, true, resolve);
        return { kind: 'color', background: isColorString(layer) ? hex8(layer) : layer };
    });
};

/**
 * Поля геометрии слоя платформы по виду и платформе: поле слоя → поле модели (`null` — поле обязательно, но в модель
 * не попадает). У Conic Android начального угла нет: модель получает 0°.
 */
const NATIVE_GEOMETRY: Record<
    string,
    { type: GradientModel['type']; fields: Record<string, keyof GradientModel | null> }
> = {
    'linear:ios': { type: 'linear', fields: { angle: 'angle' } },
    'linear:android': { type: 'linear', fields: { angle: 'angle' } },
    'radial:ios': {
        type: 'radial',
        fields: { centerX: 'centerX', centerY: 'centerY', startRadius: null, endRadius: 'radius' },
    },
    'radial:android': { type: 'radial', fields: { centerX: 'centerX', centerY: 'centerY', radius: 'radius' } },
    'angular:ios': {
        type: 'conic',
        fields: { centerX: 'centerX', centerY: 'centerY', startAngle: 'from', endAngle: null },
    },
    'angular:android': { type: 'conic', fields: { centerX: 'centerX', centerY: 'centerY' } },
};
/** Поля модели в процентах: в слое платформы они хранятся долями 0–1. */
const PERCENT_FIELDS = new Set<string>(['centerX', 'centerY', 'radius']);

/** Стопы слоя платформы: `locations` и `colors` одной длины, не меньше двух, позиции 0–1 не убывают. */
const nativeStops = ({ locations, colors }: NativeLayer): GradientStopModel[] | null => {
    if (!Array.isArray(locations) || !Array.isArray(colors) || locations.length !== colors.length) return null;
    const stops = locations.map((location, index) => ({
        color: colors[index] as string,
        position: typeof location === 'number' ? Number((location * 100).toFixed(6)) : NaN,
    }));
    const ordered = stops.every(
        (stop, index) =>
            typeof stop.color === 'string' &&
            isColorString(stop.color) &&
            stop.position >= 0 &&
            stop.position <= 100 &&
            (index === 0 || stop.position >= stops[index - 1].position),
    );
    return ordered && stops.length >= 2 ? stops : null;
};

/** Модель слоя платформы или `null`, если слой не градиент или в нём нет полей своего вида. */
export const parseNativeLayer = (layer: NativeLayer, platform: NativePlatform): GradientModel | null => {
    const geometry = NATIVE_GEOMETRY[`${layer?.kind}:${platform}`];
    const stops = geometry ? nativeStops(layer) : null;
    const fields = Object.entries(geometry?.fields ?? {});
    if (!stops || fields.some(([field]) => typeof layer[field] !== 'number')) return null;
    const values = fields.flatMap(([field, target]) => {
        const value = layer[field] as number;
        return target ? [[target, PERCENT_FIELDS.has(target) ? Number((value * 100).toFixed(6)) : value]] : [];
    });
    return { ...GRADIENT_DEFAULTS, ...Object.fromEntries(values), type: geometry.type, stops };
};

/** Цвет сплошного значения платформы: строка, массив из одной строки или один слой `color`; иначе `null`. */
export const nativeSolidColor = (value: unknown): string | null => {
    const single = Array.isArray(value) && value.length === 1 ? value[0] : value;
    const layer = single as NativeLayer | null | undefined;
    const color = typeof single === 'string' ? single.trim() : layer?.kind === 'color' ? layer.background : null;
    return typeof color === 'string' && isColorString(color) ? color : null;
};
