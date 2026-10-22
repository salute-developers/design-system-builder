import {
    GRADIENT_DEFAULTS,
    formatWebLayer,
    isColorString,
    parseWebLayer,
    stopOpacity,
    webLayers,
    withStopOpacity,
    type GradientModel,
    type ValueKind,
} from './gradient';
import { formatNativeLayer, nativeSolidColor, parseNativeLayer, type NativeLayer } from './nativeGradient';

export type PaintPlatform = 'web' | 'ios' | 'android';

/**
 * Значение платформы в терминах выбора цвета: цвет (HEX или ссылка) или градиент. У градиента редактируется
 * первый градиентный слой [index], остальные слои [layers] сохраняются как есть.
 */
export type Paint =
    | { kind: 'color'; color: string }
    | { kind: 'gradient'; model: GradientModel; layers: unknown[]; index: number };

const isLayerObject = (value: unknown): value is NativeLayer =>
    Boolean(value) && typeof value === 'object' && typeof (value as NativeLayer).kind === 'string';

/**
 * Модель слоя-градиента, `null` у слоя-цвета, `undefined` у слоя неизвестного вида или без полей своего вида:
 * значение с таким слоем не редактируется, чтобы его не потерять.
 */
const readLayer = (layer: unknown, platform: PaintPlatform): GradientModel | null | undefined => {
    if (platform !== 'web' && !isLayerObject(layer)) return undefined;
    if (nativeSolidColor([layer])) return null;
    return (
        (platform === 'web' ? parseWebLayer(String(layer)) : parseNativeLayer(layer as NativeLayer, platform)) ??
        undefined
    );
};

/**
 * Цвет или градиент значения платформы; `null`, если значение не цвет и не градиент. Градиент — хотя бы один
 * слой-градиент при остальных слоях-цветах.
 */
export const readPaint = (raw: unknown, platform: PaintPlatform): Paint | null => {
    const layers = platform === 'web' ? webLayers(raw) : raw;
    const solid = nativeSolidColor(layers);
    if (solid) return { kind: 'color', color: solid };
    const models = Array.isArray(layers) ? layers.map((layer) => readLayer(layer, platform)) : [];
    const index = models.findIndex(Boolean);
    return index < 0 || models.includes(undefined)
        ? null
        : { kind: 'gradient', model: models[index]!, layers: layers as unknown[], index };
};

/** Хранимое значение платформы: цвет — строка, градиент — слои с заменённым редактируемым слоем. */
export const writePaint = (paint: Paint, platform: PaintPlatform): unknown => {
    if (paint.kind === 'color') return paint.color;
    const layer = platform === 'web' ? formatWebLayer(paint.model) : formatNativeLayer(paint.model, platform);
    const layers = paint.layers.length ? [...paint.layers] : [layer];
    layers[Math.min(paint.index, layers.length - 1)] = layer;
    return layers;
};

/** Смена вида: цвет → Linear 90° с двумя стопами, градиент → цвет первого стопа. Ссылка на палитру сохраняется. */
export const withKind = (paint: Paint, kind: ValueKind): Paint => {
    if (paint.kind === kind) return paint;
    if (paint.kind === 'gradient')
        return {
            kind: 'color',
            color: [...paint.model.stops].sort((a, b) => a.position - b.position)[0]?.color ?? '#000000',
        };
    // Стопы «цвет» 0 % и `#F5F5F5` 100 %. Стопы web принимают только `#RRGGBB` и `#RRGGBBAA`: непрозрачный цвет
    // записывается без альфы.
    const color = paint.color.trim();
    const first = isColorString(color) ? withStopOpacity(color, stopOpacity(color)) : '#000000';
    const stops = [
        { color: first, position: 0 },
        { color: '#F5F5F5', position: 100 },
    ];
    return {
        kind: 'gradient',
        model: { ...GRADIENT_DEFAULTS, type: 'linear', angle: 90, stops },
        layers: [null],
        index: 0,
    };
};

/** Градиент с новой моделью первого слоя. */
export const withModel = (paint: Extract<Paint, { kind: 'gradient' }>, model: GradientModel): Paint => ({
    ...paint,
    model,
});
