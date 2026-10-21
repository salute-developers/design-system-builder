import {
    formatPaletteReference,
    parsePaletteReference,
    templateRampName,
    type PaletteRampRef,
} from '../../palette/domain';
import type { NativePlatform, ShadowLayer, SizeToken, SizeTokenValue } from './types';
import { colorWithOpacity, opacityOf } from './validation';

/** Название ступени палитры для поля цвета слоя: «Gray 900»; [rampName] — имя растяжки в палитре темы. */
export const layerColorLabel = (layer: ShadowLayer, rampName?: (ref: PaletteRampRef) => string | undefined) => {
    const reference = parsePaletteReference(layer.colorRef);
    if (!reference) return null;
    return `${rampName?.(reference) ?? templateRampName(reference)} ${reference.step}`;
};

/** Прозрачность слоя в процентах: у ссылки — из ссылки, у HEX — из альфа-канала. */
export const layerOpacity = (layer: ShadowLayer) => {
    const reference = parsePaletteReference(layer.colorRef);
    if (reference) return Math.round((reference.opacity ?? 1) * 100);
    return opacityOf(layer.color);
};

/** Слой без ссылки на палитру. */
const withoutReference = ({ offsetX, offsetY, blur, spread, color }: ShadowLayer): ShadowLayer => ({
    offsetX,
    offsetY,
    blur,
    spread,
    color,
});

/** Цвет слоя из HEX: ссылка на палитру заменяется HEX-цветом с прежней прозрачностью. */
export const layerWithHex = (layer: ShadowLayer, hex: string): ShadowLayer => ({
    ...withoutReference(layer),
    color: colorWithOpacity(hex, layerOpacity(layer)),
});

/** Цвет слоя из выбора цвета: HEX (`#RRGGBB` или `#RRGGBBAA`) или ссылка на ступень с [resolvedHex] для показа. */
export const layerWithColor = (layer: ShadowLayer, value: string, resolvedHex?: string | null): ShadowLayer => {
    const reference = parsePaletteReference(value);
    if (reference) {
        const opacity = reference.opacity ?? 1;
        return {
            ...layer,
            colorRef: formatPaletteReference({ ...reference, opacity }),
            color: colorWithOpacity(resolvedHex ?? layer.color, Math.round(opacity * 100)),
        };
    }
    const digits = value.replace('#', '');
    return {
        ...withoutReference(layer),
        color: digits.length === 8 ? `#${digits.toUpperCase()}` : colorWithOpacity(`#${digits}`, 100),
    };
};

/** Прозрачность слоя в процентах: у ссылки меняется прозрачность ссылки, у HEX — альфа-канал. */
export const layerWithOpacity = (layer: ShadowLayer, percent: number): ShadowLayer => {
    const reference = parsePaletteReference(layer.colorRef);
    if (!reference) return { ...layer, color: colorWithOpacity(layer.color, percent) };
    const opacity = Math.round(percent) / 100;
    return {
        ...layer,
        colorRef: formatPaletteReference({ ...reference, opacity }),
        color: colorWithOpacity(layer.color, percent),
    };
};

/** Набор слоёв тени: веб или свои слои платформы. */
export type LayerScope = 'web' | NativePlatform;

/** Слои набора [scope] токена тени; у радиуса и отступа и без своих слоёв платформы — `null`. */
export const scopeLayers = (token: SizeToken, scope: LayerScope): ShadowLayer[] | null => {
    if (token.kind !== 'shadow') return null;
    return scope === 'web' ? token.layers : (token.platforms[scope]?.layers ?? null);
};

/** Значение тени с изменённым слоем [index] набора [scope]. */
export const withLayer = (
    value: SizeTokenValue,
    scope: LayerScope,
    index: number,
    change: (layer: ShadowLayer) => ShadowLayer,
): SizeTokenValue => {
    if (value.kind !== 'shadow') return value;
    const update = (layers: ShadowLayer[]) =>
        layers.map((layer, position) => (position === index ? change(layer) : layer));
    if (scope === 'web') return { ...value, layers: update(value.layers) };
    const own = value.platforms[scope];
    return own ? { ...value, platforms: { ...value.platforms, [scope]: update(own) } } : value;
};
