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
import { getRestoredColorFromPalette, type ThemeMode } from '@salutejs/plasma-tokens-utils';

import { getColorAndOpacity, getNormalizedColor, getStateColor } from './color';
import { sectionToFormulaMap } from '../types';

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

const normalizeGradientColor = (rawColor: string): string => {
    const [color, opacity] = getColorAndOpacity(rawColor);
    return getNormalizedColor(color, opacity);
};

const linearGradientStopsToCSS = (paint: ImportPaintLinearGradient): string => {
    return paint.gradientStops
        .map((stop) => {
            const color = normalizeGradientColor(stop.color);
            const position = (parseFloat(stop.stop) * 100).toFixed(1);

            return `${color} ${position}%`;
        })
        .join(', ');
};

const radialGradientStopsToCSS = (paint: ImportPaintRadialGradient): string => {
    return paint.colors
        .map((color, index) => {
            const normalizedColor = normalizeGradientColor(color);
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
    return {
        kind: 'linear' as const,
        colors: paint.gradientStops.map((stop) => normalizeGradientColor(stop.color)),
        locations: paint.gradientStops.map((stop) => parseFloat(stop.stop)),
        angle: paint.gradientAngle,
    };
};

const radialGradientToIOSNative = (paint: ImportPaintRadialGradient) => {
    return {
        kind: 'radial' as const,
        colors: paint.colors.map((color) => normalizeGradientColor(color)),
        locations: paint.locations.map((loc) => parseFloat(loc)),
        centerX: paint.centerX,
        centerY: paint.centerY,
        startRadius: 0,
        endRadius: paint.radius,
    };
};

const radialGradientToAndroidNative = (paint: ImportPaintRadialGradient) => {
    return {
        kind: 'radial' as const,
        colors: paint.colors.map((color) => normalizeGradientColor(color)),
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

const getAdditionalColorValues = (value: string, themeMode: string, groupName: string, subgroupName: string) => {
    const sectionName = sectionToFormulaMap[groupName.toLocaleLowerCase()];

    if (!sectionName) {
        return undefined;
    }

    let mode = themeMode as ThemeMode;

    if (
        (themeMode === 'dark' && (subgroupName === 'default' || subgroupName.includes('dark'))) ||
        (themeMode === 'light' && (subgroupName === 'inverse' || subgroupName.includes('dark')))
    ) {
        mode = 'dark';
    }
    if (
        (themeMode === 'dark' && (subgroupName === 'inverse' || subgroupName.includes('light'))) ||
        (themeMode === 'light' && (subgroupName === 'default' || subgroupName.includes('light')))
    ) {
        mode = 'light';
    }

    const restoredValue = getRestoredColorFromPalette(value, -1);
    const getDefaultStateToken = getStateColor(restoredValue, sectionName, mode);
    const activeValue = getDefaultStateToken('active');
    const hoverValue = getDefaultStateToken('hover');

    return [activeValue, hoverValue] as const;
};

const isStateToken = (name: string): boolean => {
    return name.endsWith('-hover') || name.endsWith('-active');
};

const generateStateTokens = (name: string, value: string, theme: Theme): void => {
    const [themeMode, groupName, subgroupName] = name.split('.');
    const additionalValues = getAdditionalColorValues(value, themeMode, groupName, subgroupName);

    if (!additionalValues) {
        return;
    }

    const [activeValue, hoverValue] = additionalValues;
    const tags = name.split('.');

    const createStateMeta = (postfix: string) => {
        const stateTags = [...tags];
        const last = stateTags.pop()!;
        stateTags.push(last + postfix);

        return {
            name: stateTags.join('.'),
            tags: stateTags,
            displayName: getDisplayName(stateTags.join('.')),
            enabled: true,
        };
    };

    for (const [postfix, stateValue] of [
        ['-active', activeValue],
        ['-hover', hoverValue],
    ] as const) {
        const stateName = createStateMeta(postfix).name;
        const existingToken = theme.getToken(stateName, 'color');

        if (existingToken) {
            existingToken.setValue('web', stateValue);
            existingToken.setValue('ios', stateValue);
            existingToken.setValue('android', stateValue);
        } else {
            const stateToken = new ColorToken(createStateMeta(postfix), {
                web: new WebColor(stateValue),
                ios: new IOSColor(stateValue),
                android: new AndroidColor(stateValue),
            });
            theme.addToken('color', stateToken);
        }
    }
};

export const importTokensToTheme = (data: ImportData, theme: Theme): void => {
    for (const style of data.localStyles) {
        const nameParts = style.name.split('.');
        const isExcluded = nameParts.includes('syntax') || nameParts.includes('custom');

        if (!style.paints.length || style.enabled === false || isExcluded) {
            continue;
        }

        if (isStateToken(style.name)) {
            continue;
        }

        const firstPaint = style.paints[0];

        if (firstPaint.type === 'color') {
            const value = resolveColorValue(firstPaint.color, firstPaint.opacity);

            const existingToken = theme.getToken(style.name, 'color');

            if (existingToken) {
                existingToken.setValue('web', value);
                existingToken.setValue('ios', value);
                existingToken.setValue('android', value);
            } else {
                const token = createColorToken(style, firstPaint);
                theme.addToken('color', token);
            }

            generateStateTokens(style.name, value, theme);

            continue;
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
