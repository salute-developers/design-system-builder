import {
    ColorToken,
    WebColor,
    IOSColor,
    AndroidColor,
    GradientToken,
    WebGradient,
    IOSGradient,
    AndroidGradient,
    Theme,
} from '../controllers';

import { general } from '@salutejs/plasma-colors';

import { getNormalizedColor } from './color';

const buildPaletteMap = (): Map<string, string> => {
    const map = new Map<string, string>();

    for (const [color, saturations] of Object.entries(general)) {
        for (const [saturation, hex] of Object.entries(saturations as Record<string, string>)) {
            map.set((hex as string).toUpperCase(), `general.${color}.${saturation}`);
        }
    }

    return map;
};

const paletteMap = buildPaletteMap();

const getPaletteValue = (hex: string, opacity: string): string | undefined => {
    const normalizedHex = hex.toUpperCase().slice(0, 7);
    const paletteRef = paletteMap.get(normalizedHex);

    if (!paletteRef) {
        return undefined;
    }

    const opacityNum = parseFloat(opacity);

    if (opacityNum < 1) {
        return `[${paletteRef}][${opacityNum}]`;
    }

    return `[${paletteRef}]`;
};

interface ImportPaintColor {
    type: 'color';
    opacity: string;
    color: string;
}

interface ImportGradientStop {
    stop: string;
    color: string;
}

interface ImportPaintLinearGradient {
    type: 'gradient';
    kind: 'linear';
    opacity: string;
    gradientAngle: number;
    gradientStops: ImportGradientStop[];
    gradientTransform: number[][];
}

interface ImportPaintRadialGradient {
    type: 'gradient';
    kind: 'radial';
    opacity: string;
    locations: string[];
    colors: string[];
    centerX: number;
    centerY: number;
    radius: number;
}

type ImportPaintGradient = ImportPaintLinearGradient | ImportPaintRadialGradient;

type ImportPaint = ImportPaintColor | ImportPaintGradient;

interface ImportLocalStyle {
    name: string;
    initialName: string;
    enabled?: boolean;
    paints: ImportPaint[];
}

interface ImportData {
    id: string;
    name: string;
    projectName: string;
    localStyles: ImportLocalStyle[];
}

const toCamelSegment = (part: string, capitalize: boolean): string => {
    return part
        .split('-')
        .map((segment, index) => {
            if (!capitalize && index === 0) {
                return segment;
            }

            return segment.charAt(0).toUpperCase() + segment.slice(1);
        })
        .join('');
};

const getDisplayName = (name: string): string => {
    const [, category, subcategory, ...tokenParts] = name.split('.');
    const isDefault = subcategory === 'default';

    const parts = [...(isDefault ? [] : [subcategory]), category, ...tokenParts];

    return parts.map((part, index) => toCamelSegment(part, index > 0)).join('');
};

const resolveColorValue = (color: string, opacity: string): string => {
    return getPaletteValue(color, opacity) ?? getNormalizedColor(color, parseFloat(opacity));
};

const linearGradientStopsToCSS = (paint: ImportPaintLinearGradient): string => {
    return paint.gradientStops
        .map((stop) => {
            const opacity = parseFloat(paint.opacity);
            const color = getNormalizedColor(stop.color, opacity);
            const position = (parseFloat(stop.stop) * 100).toFixed(1);

            return `${color} ${position}%`;
        })
        .join(', ');
};

const radialGradientStopsToCSS = (paint: ImportPaintRadialGradient): string => {
    const opacity = parseFloat(paint.opacity);

    return paint.colors
        .map((color, index) => {
            const normalizedColor = getNormalizedColor(color, opacity);
            const position = (parseFloat(paint.locations[index]) * 100).toFixed(1);

            return `${normalizedColor} ${position}%`;
        })
        .join(', ');
};

const linearGradientToWebCSS = (paint: ImportPaintLinearGradient): string => {
    return `linear-gradient(${paint.gradientAngle}deg, ${linearGradientStopsToCSS(paint)})`;
};

const radialGradientToWebCSS = (paint: ImportPaintRadialGradient): string => {
    const cx = (paint.centerX * 100).toFixed(1);
    const cy = (paint.centerY * 100).toFixed(1);
    const r = (paint.radius * 100).toFixed(1);

    return `radial-gradient(${r}% ${r}% at ${cx}% ${cy}%, ${radialGradientStopsToCSS(paint)})`;
};

const gradientToWebCSS = (paint: ImportPaintGradient): string => {
    if (paint.kind === 'radial') {
        return radialGradientToWebCSS(paint);
    }

    return linearGradientToWebCSS(paint);
};

const linearGradientToNative = (paint: ImportPaintLinearGradient) => {
    const opacity = parseFloat(paint.opacity);

    return {
        kind: 'linear' as const,
        colors: paint.gradientStops.map((stop) => getNormalizedColor(stop.color, opacity)),
        locations: paint.gradientStops.map((stop) => parseFloat(stop.stop)),
        angle: paint.gradientAngle,
    };
};

const radialGradientToIOSNative = (paint: ImportPaintRadialGradient) => {
    const opacity = parseFloat(paint.opacity);

    return {
        kind: 'radial' as const,
        colors: paint.colors.map((color) => getNormalizedColor(color, opacity)),
        locations: paint.locations.map((loc) => parseFloat(loc)),
        centerX: paint.centerX,
        centerY: paint.centerY,
        startRadius: 0,
        endRadius: paint.radius,
    };
};

const radialGradientToAndroidNative = (paint: ImportPaintRadialGradient) => {
    const opacity = parseFloat(paint.opacity);

    return {
        kind: 'radial' as const,
        colors: paint.colors.map((color) => getNormalizedColor(color, opacity)),
        locations: paint.locations.map((loc) => parseFloat(loc)),
        centerX: paint.centerX,
        centerY: paint.centerY,
        radius: paint.radius,
    };
};

const gradientToIOSNative = (paint: ImportPaintGradient) => {
    if (paint.kind === 'radial') {
        return radialGradientToIOSNative(paint);
    }

    return linearGradientToNative(paint);
};

const gradientToAndroidNative = (paint: ImportPaintGradient) => {
    if (paint.kind === 'radial') {
        return radialGradientToAndroidNative(paint);
    }

    return linearGradientToNative(paint);
};

const createColorToken = (style: ImportLocalStyle, paint: ImportPaintColor): ColorToken => {
    const { name } = style;
    const tags = name.split('.');
    const displayName = getDisplayName(name);
    const value = resolveColorValue(paint.color, paint.opacity);

    return new ColorToken(
        { name, tags, displayName, enabled: style.enabled ?? true },
        {
            web: new WebColor(value),
            ios: new IOSColor(value),
            android: new AndroidColor(value),
        },
    );
};

const createGradientToken = (style: ImportLocalStyle, paints: ImportPaintGradient[]): GradientToken => {
    const { name } = style;
    const tags = name.split('.');
    const displayName = getDisplayName(name);

    const webValue = paints.map(gradientToWebCSS);
    const iosValue = paints.map(gradientToIOSNative);
    const androidValue = paints.map(gradientToAndroidNative);

    return new GradientToken(
        { name, tags, displayName, enabled: style.enabled ?? true },
        {
            web: new WebGradient(webValue),
            ios: new IOSGradient(iosValue),
            android: new AndroidGradient(androidValue),
        },
    );
};

export const importTokensToTheme = (data: ImportData, theme: Theme): void => {
    for (const style of data.localStyles) {
        const nameParts = style.name.split('.');
        const isExcluded = nameParts.includes('syntax') || nameParts.includes('custom');

        if (!style.paints.length || style.enabled === false || isExcluded) {
            continue;
        }

        const firstPaint = style.paints[0];

        if (firstPaint.type === 'color') {
            const existingToken = theme.getToken(style.name, 'color');

            if (existingToken) {
                const value = resolveColorValue(firstPaint.color, firstPaint.opacity);

                existingToken.setValue('web', value);
                existingToken.setValue('ios', value);
                existingToken.setValue('android', value);

                continue;
            }

            const token = createColorToken(style, firstPaint);
            theme.addToken('color', token);
        }

        if (firstPaint.type === 'gradient') {
            const gradientPaints = style.paints.filter((paint) => paint.type === 'gradient');

            const existingToken = theme.getToken(style.name, 'gradient');

            if (existingToken) {
                const webValue = gradientPaints.map(gradientToWebCSS);
                const iosValue = gradientPaints.map(gradientToIOSNative);
                const androidValue = gradientPaints.map(gradientToAndroidNative);

                existingToken.setValue('web', webValue);
                existingToken.setValue('ios', iosValue);
                existingToken.setValue('android', androidValue);

                continue;
            }

            const token = createGradientToken(style, gradientPaints);
            theme.addToken('gradient', token);
        }
    }
};
