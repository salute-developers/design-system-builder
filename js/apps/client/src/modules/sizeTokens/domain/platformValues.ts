import type { NativePlatform, ShadowLayer, ShadowToken, SizeToken, SizeTokenValue, WrittenValue } from './types';

/** px из CSS-размера веба: `0.75rem` → 12, `4px` → 4. */
export const cssPx = (value: string) => {
    const number = parseFloat(value);
    if (!Number.isFinite(number)) return 0;
    return /px$/i.test(value.trim()) ? number : Math.round(number * 16 * 1000) / 1000;
};

/** `rem` без лишних нулей: 12 → `0.75rem`, 0 → `0rem`. */
export const toRem = (px: number) => `${Number((px / 16).toFixed(4))}rem`;

/** Слой тени из CSS-строки веба `"0rem 0.25rem 0.875rem -0.25rem #08080814"`. */
export const parseCssLayer = (css: string): ShadowLayer => {
    const [x = '0', y = '0', blur = '0', spread = '0', ...color] = css.trim().split(/\s+/);
    return { offsetX: cssPx(x), offsetY: cssPx(y), blur: cssPx(blur), spread: cssPx(spread), color: color.join(' ') };
};

/** CSS-строка слоя для веба. */
export const cssLayer = (layer: ShadowLayer) =>
    `${toRem(layer.offsetX)} ${toRem(layer.offsetY)} ${toRem(layer.blur)} ${toRem(layer.spread)} ${layer.color}`;

/** Цвет слоя для отображения. */
export const rgba = (color: string) => {
    const hex = color.replace('#', '');
    if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) return color;
    const channel = (index: number) => parseInt(hex.slice(index, index + 2), 16);
    const alpha = hex.length === 8 ? channel(6) / 255 : 1;
    return `rgba(${channel(0)}, ${channel(2)}, ${channel(4)}, ${Number(alpha.toFixed(3))})`;
};

/** `box-shadow` превью тени. */
export const boxShadow = (layers: readonly ShadowLayer[]) =>
    layers
        .map((layer) => `${layer.offsetX}px ${layer.offsetY}px ${layer.blur}px ${layer.spread}px ${rgba(layer.color)}`)
        .join(', ');

export const sameLayers = (a: readonly ShadowLayer[], b: readonly ShadowLayer[]) =>
    a.length === b.length &&
    a.every(
        (layer, index) =>
            layer.offsetX === b[index].offsetX &&
            layer.offsetY === b[index].offsetY &&
            layer.blur === b[index].blur &&
            layer.spread === b[index].spread &&
            layer.color.toUpperCase() === b[index].color.toUpperCase(),
    );

/** Значение токена в форме операции изменения. */
export const tokenValue = (token: SizeToken): SizeTokenValue | null => {
    if (token.kind === 'shadow') {
        const platforms: Partial<Record<NativePlatform, ShadowLayer[]>> = {};
        (Object.keys(token.platforms) as NativePlatform[]).forEach((platform) => {
            const own = token.platforms[platform];
            if (own) platforms[platform] = own.layers;
        });
        return { kind: 'shadow', layers: token.layers, fallbackElevation: token.fallbackElevation, platforms };
    }
    if (token.fullRounding || token.valuePx === null) return null;
    return { kind: 'dimension', valuePx: token.valuePx, platforms: { ...token.platforms } };
};

/** Токен с несохранённым значением: веб и свои значения платформ из [value]. */
export const withValue = (token: SizeToken, value: SizeTokenValue | undefined): SizeToken => {
    if (!value) return token;
    if (token.kind === 'shadow' && value.kind === 'shadow') {
        const platforms: ShadowToken['platforms'] = {};
        (Object.keys(value.platforms) as NativePlatform[]).forEach((platform) => {
            const layers = value.platforms[platform];
            if (layers) platforms[platform] = { layers };
        });
        return { ...token, layers: value.layers, fallbackElevation: value.fallbackElevation, platforms };
    }
    if (token.kind !== 'shadow' && value.kind === 'dimension') {
        return { ...token, valuePx: value.valuePx, platforms: { ...value.platforms } };
    }
    return token;
};

/** Платформы без своего значения, чьё текущее значение отличается от веба. */
export const differingPlatforms = (token: SizeToken): NativePlatform[] =>
    (['ios', 'android'] as const).filter((platform) => {
        if (token.platforms[platform] !== undefined) return false;
        if (token.kind === 'shadow') {
            const native = token.native[platform];
            return native !== null && !sameLayers(native.layers, token.layers);
        }
        const native = token.native[platform];
        return !token.fullRounding && native !== null && native !== token.valuePx;
    });

/** Значение платформы модели темы: тень хранится массивом слоёв, остальное — одним значением. */
export const themeModelValue = (kind: SizeToken['kind'], value: unknown) =>
    kind === 'shadow'
        ? ([] as unknown[]).concat(value as never)
        : Array.isArray(value) && value.length === 1
          ? value[0]
          : value;

/** Значения платформ модели темы из записанных операцией значений. */
export const themeValuesFromWritten = (kind: SizeToken['kind'], values: readonly WrittenValue[]) =>
    Object.fromEntries(values.map((item) => [item.platform, themeModelValue(kind, item.value)])) as Partial<
        Record<WrittenValue['platform'], unknown>
    >;

const nativeLayer = (layer: ShadowLayer) => ({
    color: layer.color,
    offsetX: layer.offsetX,
    offsetY: layer.offsetY,
    blurRadius: layer.blur,
    spreadRadius: layer.spread,
});

/**
 * Значения платформ модели темы по токену в формате чтения — для токенов, созданных или перечитанных без
 * записанных значений. У полного скругления значения не строятся: их формат не задаётся в px.
 */
export const themeValuesFromToken = (token: SizeToken): Record<WrittenValue['platform'], unknown> | null => {
    if (token.kind === 'shadow') {
        const layersOf = (platform: NativePlatform) =>
            token.platforms[platform]?.layers ?? token.native[platform]?.layers ?? token.layers;
        return {
            web: token.layers.map(cssLayer),
            android: layersOf('android').map((layer, index) => ({
                ...nativeLayer(layer),
                fallbackElevation: index === 0 ? token.fallbackElevation : 0,
            })),
            ios: layersOf('ios').map(nativeLayer),
        };
    }
    if (token.fullRounding || token.valuePx === null) return null;
    const valuePx = token.valuePx;
    const px = (platform: NativePlatform) => token.platforms[platform] ?? token.native[platform] ?? valuePx;
    const native = (platform: NativePlatform) =>
        token.kind === 'radius' ? { kind: 'round', cornerRadius: px(platform) } : { value: px(platform) };
    return { web: toRem(valuePx), ios: native('ios'), android: native('android') };
};
