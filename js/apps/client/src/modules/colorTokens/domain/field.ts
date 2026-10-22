import { parsePaletteReference, templateRampName, type PaletteRampRef, type PaletteReference } from '../../palette';
import { formatWebLayer, gradientLabel } from './gradient';
import { parseNativeLayer, type NativeLayer } from './nativeGradient';
import { readPaint, type PaintPlatform } from './paint';
import type { ColorFieldValue } from './types';

/** Вычисление цвета ссылки по палитре темы: HEX с альфой или `null`, если ступени нет. */
export type PaletteColorResolver = (value: string, tokenName: string) => string | null;

/** Имя растяжки ссылки в группе токена; без палитры — имя шаблона. */
export type RampNameResolver = (reference: PaletteRampRef, tokenName: string) => string;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const REFERENCE = /\[(?:general|additional)\.[A-Za-z0-9]+\.\d+\](?:\[\d+(?:\.\d+)?\])?/g;

/** Строковое значение платформы: ссылка, HEX или слои градиента через запятую. */
export const rawValue = (value: unknown): string => {
    if (Array.isArray(value))
        return value.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join(', ');
    return value === undefined || value === null ? '' : String(value);
};

/** Имя ступени для ссылки: «Blue 500». */
export const referenceLabel = (reference: PaletteReference, tokenName: string, rampName?: RampNameResolver) =>
    `${rampName?.(reference, tokenName) ?? templateRampName(reference)} ${reference.step}`;

/**
 * Поле значения для инспектора, чипов и борда: вид значения, метка ступени палитры, прозрачность и цвет
 * отображения. Ссылки стопов градиента раскрываются по палитре темы.
 */
export const colorField = (
    value: unknown,
    tokenName: string,
    resolve: PaletteColorResolver,
    rampName?: RampNameResolver,
    platform: PaintPlatform = 'web',
): ColorFieldValue => {
    const paint = readPaint(value, platform);
    const base = { raw: value, paint, kind: paint?.kind ?? null, platforms: {}, missing: null };
    if (paint?.kind === 'gradient') {
        let missing: string | null = null;
        // CSS-слои для отображения: слои платформы переводятся в CSS (Conic Android — с 0°), ссылки раскрываются.
        const resolved = paint.layers
            .map((layer) => {
                const native = layer as NativeLayer;
                if (platform === 'web') return String(layer);
                if (native.kind === 'color') return String(native.background);
                const model = parseNativeLayer(native, platform);
                return model ? formatWebLayer(model) : 'transparent';
            })
            .map((layer) =>
                layer.replace(REFERENCE, (match) => {
                    const hex = resolve(match, tokenName);
                    const reference = parsePaletteReference(match);
                    if (!hex && reference) missing ??= referenceLabel(reference, tokenName, rampName);
                    return hex ?? 'transparent';
                }),
            )
            .join(', ');
        const first = [...paint.model.stops].sort((a, b) => a.position - b.position)[0]?.color ?? '';
        const baseColor = first.startsWith('#') ? first : (resolve(first, tokenName) ?? 'transparent');
        return {
            ...base,
            value: platform === 'web' ? rawValue(value) : JSON.stringify(value),
            resolved,
            baseColor,
            paletteLabel: null,
            opacity: 1,
            missing,
        };
    }
    const raw = paint?.kind === 'color' ? paint.color : rawValue(value);
    const reference = parsePaletteReference(raw);
    if (reference) {
        const resolved = resolve(raw, tokenName);
        const paletteLabel = referenceLabel(reference, tokenName, rampName);
        return {
            ...base,
            value: raw,
            resolved: resolved ?? 'transparent',
            baseColor: resolved ?? 'transparent',
            paletteLabel,
            opacity: reference.opacity ?? 1,
            missing: resolved ? null : paletteLabel,
        };
    }
    const resolved = HEX.test(raw) ? raw : 'transparent';
    const alpha = raw.replace('#', '');
    return {
        ...base,
        value: raw,
        resolved,
        baseColor: resolved,
        paletteLabel: null,
        opacity: alpha.length === 8 ? Math.round((parseInt(alpha.slice(6), 16) / 255) * 100) / 100 : 1,
    };
};

/**
 * Текст поля значения (`colorFieldDisplayValue`): тип и угол градиента, метка ступени или HEX без `#`; значение,
 * которое не цвет и не градиент, показывается как есть.
 */
export const fieldText = (value: ColorFieldValue) => {
    if (value.paint?.kind === 'gradient') return gradientLabel(value.paint.model, value.paint.layers.length);
    if (value.paletteLabel) return value.paletteLabel;
    // Некорректное значение (например, ссылка со ступенью NaN) показывается как есть, чтобы его было видно.
    if (!/^#[0-9a-f]{3,8}$/i.test(value.value)) return value.value;
    return value.value.replace('#', '').slice(0, 6).toUpperCase();
};

/** Пустое значение поля: определения нет в теме. */
export const emptyField = (): ColorFieldValue => ({
    value: '',
    raw: '',
    resolved: 'transparent',
    baseColor: 'transparent',
    paletteLabel: null,
    opacity: 1,
    kind: null,
    paint: null,
    missing: null,
    platforms: {},
});

/** Совпадают ли два значения поля для признака связи подтемы. */
export const sameValue = (a: ColorFieldValue, b: ColorFieldValue) =>
    a.value.replace(/\s+/g, '').toLowerCase() === b.value.replace(/\s+/g, '').toLowerCase();
