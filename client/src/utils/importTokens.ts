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

interface ImportPaintGradient {
    type: 'gradient';
    kind: 'linear' | 'radial';
    opacity: string;
    gradientAngle: number;
    gradientStops: ImportGradientStop[];
    gradientTransform: number[][];
}

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

const linearGradientToWebCSS = (paint: ImportPaintGradient): string => {
    const stops = paint.gradientStops
        .map((stop) => {
            const opacity = parseFloat(paint.opacity);
            const color = getNormalizedColor(stop.color, opacity);
            const position = (parseFloat(stop.stop) * 100).toFixed(1);

            return `${color} ${position}%`;
        })
        .join(', ');

    return `linear-gradient(${paint.gradientAngle}deg, ${stops})`;
};

const linearGradientToNative = (paint: ImportPaintGradient) => {
    const opacity = parseFloat(paint.opacity);

    const colors = paint.gradientStops.map((stop) => getNormalizedColor(stop.color, opacity));
    const locations = paint.gradientStops.map((stop) => parseFloat(stop.stop));

    return {
        kind: 'linear' as const,
        colors,
        locations,
        angle: paint.gradientAngle,
    };
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

const createGradientToken = (style: ImportLocalStyle, paint: ImportPaintGradient): GradientToken => {
    const { name } = style;
    const tags = name.split('.');
    const displayName = getDisplayName(name);
    const webValue = [linearGradientToWebCSS(paint)];
    const nativeValue = [linearGradientToNative(paint)];

    return new GradientToken(
        { name, tags, displayName, enabled: style.enabled ?? true },
        {
            web: new WebGradient(webValue),
            ios: new IOSGradient(nativeValue),
            android: new AndroidGradient(nativeValue),
        },
    );
};

export const importTokensToTheme = (data: ImportData, theme: Theme): void => {
    for (const style of data.localStyles) {
        const paint = style.paints[0];

        const nameParts = style.name.split('.');
        const isExcluded = nameParts.includes('syntax') || nameParts.includes('custom');

        if (!paint || style.enabled === false || isExcluded) {
            continue;
        }

        if (paint.type === 'color') {
            const existingToken = theme.getToken(style.name, 'color');

            if (existingToken) {
                const value = resolveColorValue(paint.color, paint.opacity);

                existingToken.setValue('web', value);
                existingToken.setValue('ios', value);
                existingToken.setValue('android', value);

                continue;
            }

            const token = createColorToken(style, paint);
            theme.addToken('color', token);
        }

        if (paint.type === 'gradient') {
            const existingToken = theme.getToken(style.name, 'gradient');

            if (existingToken) {
                const webValue = [linearGradientToWebCSS(paint)];
                const nativeValue = [linearGradientToNative(paint)];

                existingToken.setValue('web', webValue);
                existingToken.setValue('ios', nativeValue);
                existingToken.setValue('android', nativeValue);

                continue;
            }

            const token = createGradientToken(style, paint);
            theme.addToken('gradient', token);
        }
    }
};
