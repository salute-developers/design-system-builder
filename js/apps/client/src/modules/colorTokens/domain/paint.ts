import { parsePaletteReference } from '../../palette';
import {
    GRADIENT_DEFAULTS,
    formatWebLayer,
    hex8,
    parseWebLayer,
    isColorString,
    webLayers,
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

/** Цвет или градиент значения платформы; `null`, если значение не цвет и не градиент. */
export const readPaint = (raw: unknown, platform: PaintPlatform): Paint | null => {
    if (platform === 'web') {
        const layers = webLayers(raw);
        if (layers.length === 1 && isColorString(layers[0])) return { kind: 'color', color: layers[0] };
        // Градиент — хотя бы один слой-градиент по грамматике при остальных слоях-цветах.
        const models = layers.map(parseWebLayer);
        const index = models.findIndex(Boolean);
        if (index < 0 || layers.some((layer, i) => !models[i] && !isColorString(layer))) return null;
        return { kind: 'gradient', model: models[index]!, layers, index };
    }
    const solid = nativeSolidColor(raw);
    if (solid) return { kind: 'color', color: solid };
    if (!Array.isArray(raw) || !raw.length || !raw.every(isLayerObject)) return null;
    const models = raw.map((layer) => (layer.kind === 'color' ? null : parseNativeLayer(layer, platform)));
    // Слой неизвестного вида или без полей своего вида: значение не редактируется, чтобы его не потерять.
    if (raw.some((layer, index) => layer.kind !== 'color' && !models[index])) return null;
    if (raw.some((layer) => layer.kind === 'color' && !nativeSolidColor([layer]))) return null;
    const index = models.findIndex(Boolean);
    return index < 0 ? null : { kind: 'gradient', model: models[index]!, layers: raw, index };
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
    const first = parsePaletteReference(paint.color)
        ? color
        : /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color)
          ? hex8(color)
          : '#000000FF';
    const stops = [
        { color: first.startsWith('#') && first.endsWith('FF') ? first.slice(0, 7) : first, position: 0 },
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
