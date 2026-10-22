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
 * Модель слоя платформы или `null`, если слой не градиент или в нём нет полей своего вида. У Conic Android
 * начального угла нет: модель получает 0°.
 */
export const parseNativeLayer = (layer: NativeLayer, platform: NativePlatform): GradientModel | null => {
    if (!layer || typeof layer !== 'object') return null;
    const locations = Array.isArray(layer.locations) ? (layer.locations as unknown[]) : null;
    const colors = Array.isArray(layer.colors) ? (layer.colors as unknown[]) : null;
    if (!locations || !colors || locations.length !== colors.length || locations.length < 2) return null;
    if (locations.some((item) => typeof item !== 'number') || colors.some((item) => typeof item !== 'string'))
        return null;
    const stops = locations.map((location, index) => ({
        color: colors[index] as string,
        position: Number(((location as number) * 100).toFixed(6)),
    }));
    if (stops.some((stop) => !isColorString(stop.color) || stop.position < 0 || stop.position > 100)) return null;
    if (stops.some((stop, index) => index > 0 && stop.position < stops[index - 1].position)) return null;
    const { angle, startAngle, endAngle, startRadius } = layer;
    // Центр и радиус — в процентах.
    const [centerX, centerY, radius] = [
        layer.centerX,
        layer.centerY,
        platform === 'ios' ? layer.endRadius : layer.radius,
    ].map((value) => (typeof value === 'number' ? Number((value * 100).toFixed(6)) : null));
    const base = { ...GRADIENT_DEFAULTS, stops };
    if (layer.kind === 'linear') return typeof angle === 'number' ? { ...base, type: 'linear', angle } : null;
    if (layer.kind === 'radial') {
        if (radius === null || centerX === null || centerY === null) return null;
        if (platform === 'ios' && typeof startRadius !== 'number') return null;
        return { ...base, type: 'radial', radius, centerX, centerY };
    }
    if (layer.kind !== 'angular' || centerX === null || centerY === null) return null;
    if (platform === 'android') return { ...base, type: 'conic', from: 0, centerX, centerY };
    if (typeof startAngle !== 'number' || typeof endAngle !== 'number') return null;
    return { ...base, type: 'conic', from: startAngle, centerX, centerY };
};

/** Цвет сплошного значения платформы: строка, массив из одной строки или один слой `color`; иначе `null`. */
export const nativeSolidColor = (value: unknown): string | null => {
    const single = Array.isArray(value) && value.length === 1 ? value[0] : value;
    if (typeof single === 'string') return isColorString(single) ? single.trim() : null;
    if (single && typeof single === 'object' && (single as NativeLayer).kind === 'color') {
        const background = (single as NativeLayer).background;
        return typeof background === 'string' && isColorString(background) ? background : null;
    }
    return null;
};
