import type { JsonValue, PreviewAsset, PreviewGradientLayer, PreviewShadowLayer, PreviewThemeValue } from './types';

/**
 * Web-значения токенов дизайн-системы хранятся CSS-строками: размеры в `rem`/`px`, цвета `#RGB(A)`/`rgba(…)`,
 * тени и градиенты строками CSS, шрифты ссылками `url(…woff2)`. Модуль переводит формат хранения в единицы
 * Preview Protocol (px, `#RRGGBBAA`, слои, начертания с ресурсами) — так же, как ассемблер переводит Android-значения.
 *
 * Это знание формата хранения ДС, а не web-библиотеки: в CSS значения обратно переводит web-плагин.
 */

/** Размер шрифта по умолчанию, от которого считаются `rem`. */
const ROOT_FONT_SIZE = 16;

export type WebTokenType = 'color' | 'dimension' | 'shape' | 'typography' | 'fontFamily' | 'gradient' | 'shadow';

export type WebTokenNormalization =
    | { ok: true; value: PreviewThemeValue; assets?: PreviewAsset[] }
    | { ok: false; message: string };

const fail = (message: string): WebTokenNormalization => ({ ok: false, message });
const isRecord = (value: unknown): value is { [key: string]: JsonValue } =>
    !!value && typeof value === 'object' && !Array.isArray(value);
const round = (value: number) => Math.round(value * 1e4) / 1e4;

/** `"0.75rem"` → 12, `"12px"` → 12, `"12"`/12 → 12; иначе `NaN`. */
export const parseWebLength = (raw: unknown): number => {
    if (typeof raw === 'number') return raw;
    if (typeof raw !== 'string') return Number.NaN;
    const match = /^\s*(-?(?:\d+\.?\d*|\.\d+))(rem|px)?\s*$/i.exec(raw);
    if (!match) return Number.NaN;
    const value = Number(match[1]);
    return round(match[2]?.toLowerCase() === 'rem' ? value * ROOT_FONT_SIZE : value);
};

const hex2 = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
        .toString(16)
        .padStart(2, '0')
        .toUpperCase();

/** Цвет CSS (`#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`, `rgb(…)`, `rgba(…)`, `transparent`) → `#RRGGBBAA`. */
export const parseWebColor = (raw: unknown): string | undefined => {
    if (typeof raw !== 'string') return undefined;
    const value = raw.trim();
    if (value.toLowerCase() === 'transparent') return '#00000000';
    const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value)?.[1];
    if (hex) {
        const full = hex.length <= 4 ? [...hex].map((digit) => digit + digit).join('') : hex;
        return `#${full.toUpperCase()}${full.length === 6 ? 'FF' : ''}`;
    }
    const rgb = /^rgba?\(\s*([^)]*)\)$/i.exec(value)?.[1];
    if (!rgb) return undefined;
    const parts = rgb.split(/\s*[,/]\s*|\s+/).filter(Boolean);
    if (parts.length !== 3 && parts.length !== 4) return undefined;
    const channel = (part: string) => (part.endsWith('%') ? (Number(part.slice(0, -1)) * 255) / 100 : Number(part));
    const alpha =
        parts[3] === undefined ? 1 : parts[3].endsWith('%') ? Number(parts[3].slice(0, -1)) / 100 : Number(parts[3]);
    const channels = parts.slice(0, 3).map(channel);
    if ([...channels, alpha].some((part) => !Number.isFinite(part))) return undefined;
    return `#${channels.map(hex2).join('')}${hex2(alpha * 255)}`;
};

/** Делит список CSS по запятым верхнего уровня (запятые внутри `rgba(…)` не делят). */
const splitTopLevel = (value: string, separator: ',' | ' '): string[] => {
    const parts: string[] = [];
    let depth = 0;
    let current = '';
    for (const char of value) {
        if (char === '(') depth++;
        if (char === ')') depth--;
        const splits = separator === ',' ? char === ',' : /\s/.test(char);
        if (splits && depth === 0) {
            if (current.trim()) parts.push(current.trim());
            current = '';
            continue;
        }
        current += char;
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
};

/** Список строк значения: токен хранит одну строку или массив строк (слои). */
const layerStrings = (raw: JsonValue): string[] | undefined => {
    const items = Array.isArray(raw) ? raw : [raw];
    if (!items.length || items.some((item) => typeof item !== 'string')) return undefined;
    return (items as string[]).flatMap((item) => splitTopLevel(item, ','));
};

/** Тень CSS `x y blur spread color` (по слоям) → `shadow.layers`. `inset` протокол не моделирует. */
const normalizeShadow = (raw: JsonValue): WebTokenNormalization => {
    const strings = layerStrings(raw);
    if (!strings?.length) return fail('shadow value must be a CSS string or a list of CSS strings');
    const layers: PreviewShadowLayer[] = [];
    for (const layer of strings) {
        const parts = splitTopLevel(layer, ' ');
        const colorIndex = parts.findIndex((part) => parseWebColor(part) !== undefined);
        const color = colorIndex === -1 ? undefined : parseWebColor(parts[colorIndex]);
        const lengths = parts.filter((_, index) => index !== colorIndex).map(parseWebLength);
        if (!color || lengths.length < 2 || lengths.length > 4 || lengths.some((length) => !Number.isFinite(length))) {
            return fail(`unsupported shadow layer "${layer}"`);
        }
        const [x, y, blur = 0, spread = 0] = lengths;
        layers.push({ x, y, blur, spread, color });
    }
    return { ok: true, value: { type: 'shadow', layers } };
};

/** Направление `linear-gradient` в градусах CSS: `45deg`, `0.25turn`, `to right`. */
const gradientAngle = (value: string): number | undefined => {
    const deg = /^(-?\d*\.?\d+)(deg|turn|rad|grad)$/i.exec(value.trim());
    if (deg) {
        const amount = Number(deg[1]);
        const unit = deg[2].toLowerCase();
        return round(
            unit === 'deg'
                ? amount
                : unit === 'turn'
                  ? amount * 360
                  : unit === 'rad'
                    ? (amount * 180) / Math.PI
                    : amount * 0.9,
        );
    }
    const sides: Record<string, number> = { 'to top': 0, 'to right': 90, 'to bottom': 180, 'to left': 270 };
    return sides[value.trim().toLowerCase()];
};

const normalizeGradientLayer = (layer: string): PreviewGradientLayer | string => {
    // Однотонное значение градиента: слой из двух одинаковых остановок.
    const solid = parseWebColor(layer);
    if (solid)
        return {
            kind: 'linear',
            angle: 180,
            stops: [
                { color: solid, position: 0 },
                { color: solid, position: 1 },
            ],
        };
    const body = /^linear-gradient\((.*)\)$/i.exec(layer.trim())?.[1];
    if (body === undefined) return `unsupported gradient layer "${layer}"`;
    const args = splitTopLevel(body, ',');
    const angle = args.length ? gradientAngle(args[0]) : undefined;
    const stopArgs = angle === undefined ? args : args.slice(1);
    const stops = stopArgs.map((stop) => {
        const [colorPart, positionPart] = splitTopLevel(stop, ' ');
        const color = parseWebColor(colorPart);
        const position = positionPart?.endsWith('%') ? Number(positionPart.slice(0, -1)) / 100 : Number.NaN;
        return { color, position };
    });
    // Остановка без позиции: первая — 0, последняя — 1, промежуточные распределяются равномерно, как в CSS.
    const placed = stops.map((stop, index) => ({
        color: stop.color,
        position: Number.isFinite(stop.position)
            ? round(Math.max(0, Math.min(1, stop.position)))
            : stops.length > 1
              ? round(index / (stops.length - 1))
              : Number.NaN,
    }));
    if (placed.length < 2 || placed.some((stop) => !stop.color || !Number.isFinite(stop.position))) {
        return `unsupported gradient layer "${layer}"`;
    }
    return {
        kind: 'linear',
        angle: angle ?? 180,
        stops: placed.map((stop) => ({ color: stop.color!, position: stop.position })),
    };
};

/** `linear-gradient(…)` (по слоям) или однотонный цвет → `gradient.layers`. */
const normalizeGradient = (raw: JsonValue): WebTokenNormalization => {
    const strings = Array.isArray(raw) ? raw : [raw];
    if (!strings.length || strings.some((item) => typeof item !== 'string')) {
        return fail('gradient value must be a CSS string or a list of CSS strings');
    }
    const layers: PreviewGradientLayer[] = [];
    for (const layer of strings as string[]) {
        const normalized = normalizeGradientLayer(layer);
        if (typeof normalized === 'string') return fail(normalized);
        layers.push(normalized);
    }
    return { ok: true, value: { type: 'gradient', layers } };
};

const FONT_WEIGHTS: Record<string, number> = { normal: 400, bold: 700, lighter: 300, bolder: 700 };

/** `"600"`, 600, `"bold"` → целое 1..1000; иначе `NaN`. */
export const parseWebFontWeight = (raw: unknown): number => {
    if (typeof raw === 'number') return raw;
    if (typeof raw !== 'string') return Number.NaN;
    return FONT_WEIGHTS[raw.trim().toLowerCase()] ?? Number(raw);
};

const fontStyleOf = (raw: unknown): 'NORMAL' | 'ITALIC' | undefined => {
    if (raw === undefined || raw === null || raw === '') return undefined;
    const value = String(raw).trim().toLowerCase();
    return value === 'italic' || value === 'oblique' ? 'ITALIC' : value === 'normal' ? 'NORMAL' : undefined;
};

/**
 * Межбуквенный интервал: `normal` → 0, `px`/`rem` → px, `em` — доля размера шрифта, в px от `fontSize`.
 */
const letterSpacingOf = (raw: unknown, fontSize: number): number => {
    if (raw === undefined || raw === null) return 0;
    if (typeof raw === 'string' && raw.trim().toLowerCase() === 'normal') return 0;
    const em = typeof raw === 'string' ? /^\s*(-?(?:\d+\.?\d*|\.\d+))em\s*$/i.exec(raw) : null;
    if (em) return round(Number(em[1]) * fontSize);
    return parseWebLength(raw);
};

/**
 * Типографика `{fontFamilyRef, fontSize: "1rem", lineHeight: "1.5rem", letterSpacing: "normal", fontWeight: "600",
 * fontStyle}` → `typography`. Ссылку на шрифт ассемблер разрешает сам.
 */
const normalizeTypography = (raw: JsonValue): WebTokenNormalization => {
    if (!isRecord(raw)) return fail('typography value must be an object');
    const ref = String(raw.fontFamilyRef ?? raw.fontFamilyTokenId ?? '');
    if (!ref) return fail('typography has no font family');
    const fontSize = parseWebLength(raw.fontSize);
    const value = {
        type: 'typography' as const,
        fontFamilyTokenId: ref,
        fontSize,
        lineHeight: parseWebLength(raw.lineHeight),
        letterSpacing: letterSpacingOf(raw.letterSpacing, fontSize),
        weight: parseWebFontWeight(raw.fontWeight),
    };
    const invalid = Object.values(value).some((part) => typeof part === 'number' && !Number.isFinite(part));
    if (invalid || !Number.isInteger(value.weight)) return fail('invalid typography value');
    const fontStyle = fontStyleOf(raw.fontStyle);
    return { ok: true, value: fontStyle ? { ...value, fontStyle } : value };
};

const FONT_FORMATS: Array<[PreviewAsset['type'], RegExp]> = [
    ['WOFF2', /\.woff2(?:$|[?#])/i],
    ['WOFF', /\.woff(?:$|[?#])/i],
    ['TTF', /\.ttf(?:$|[?#])/i],
    ['OTF', /\.otf(?:$|[?#])/i],
];

/** URL источников начертания: `src` CSS (`url('…') format('woff2')`), массив таких строк или `link`. */
const fontSources = (font: { [key: string]: JsonValue }): string[] => {
    const sources = [font.src, font.link].flatMap((item) => (Array.isArray(item) ? item : [item]));
    return sources
        .filter((item): item is string => typeof item === 'string')
        .flatMap((item) => splitTopLevel(item, ','))
        .map((item) => /url\(\s*(['"]?)(.*?)\1\s*\)/i.exec(item)?.[2] ?? item.trim())
        .filter(Boolean);
};

/**
 * Семейство `{name, fonts[{src, fontWeight, fontStyle}]}` → `fontFamily.faces` и ресурсы шрифтов. Из источников
 * начертания берётся лучший поддержанный формат: WOFF2, затем WOFF, TTF, OTF.
 */
const normalizeFontFamily = (raw: JsonValue, tokenId: string): WebTokenNormalization => {
    if (!isRecord(raw)) return fail('fontFamily value must be an object');
    const fonts = Array.isArray(raw.fonts) ? raw.fonts.filter(isRecord) : [];
    if (!fonts.length) return fail('fontFamily has no fonts');
    const assets: PreviewAsset[] = [];
    const faces = [];
    for (const font of fonts) {
        const urls = fontSources(font);
        const picked = FONT_FORMATS.map(([type, pattern]) => {
            const url = urls.find((item) => pattern.test(item));
            return url ? { type, url } : undefined;
        }).find(Boolean);
        if (!picked) return fail(`font of ${tokenId} has no supported source`);
        const weight = parseWebFontWeight(font.fontWeight ?? font.weight);
        if (!Number.isInteger(weight) || weight < 1 || weight > 1000)
            return fail(`font of ${tokenId} has invalid weight`);
        const asset: PreviewAsset = { id: `${tokenId}:${assets.length}`, type: picked.type, url: picked.url };
        assets.push(asset);
        faces.push({ assetId: asset.id, weight, style: fontStyleOf(font.fontStyle ?? font.style) ?? 'NORMAL' });
    }
    // Шрифт, который браузер не скачал, не должен ронять отрисовку: плагин подставит шрифт по умолчанию.
    return { ok: true, value: { type: 'fontFamily', faces, allowFallback: true }, assets };
};

/** Web-значение хранения токена темы → значение токена Preview Protocol. */
export const normalizeWebTokenValue = (type: WebTokenType, raw: JsonValue, tokenId: string): WebTokenNormalization => {
    if (type === 'color') {
        const value = parseWebColor(raw);
        return value ? { ok: true, value: { type: 'color', value } } : fail(`invalid color "${String(raw)}"`);
    }
    if (type === 'dimension') {
        const value = parseWebLength(isRecord(raw) ? raw.value : raw);
        return Number.isFinite(value)
            ? { ok: true, value: { type: 'dimension', value } }
            : fail(`invalid dimension "${String(raw)}"`);
    }
    if (type === 'shape') {
        const radius = parseWebLength(isRecord(raw) ? (raw.cornerRadius ?? raw.value) : raw);
        return Number.isFinite(radius)
            ? { ok: true, value: { type: 'shape', cornerRadii: [radius, radius, radius, radius] } }
            : fail(`invalid shape "${String(raw)}"`);
    }
    if (type === 'shadow') return normalizeShadow(raw);
    if (type === 'gradient') return normalizeGradient(raw);
    if (type === 'typography') return normalizeTypography(raw);
    return normalizeFontFamily(raw, tokenId);
};

/** Имя токена темы (`surface.default.accent`), а не литерал CSS (`transparent`, `#F3A912`, `auto`). */
export const isTokenName = (value: string) => /^(?=.*[a-z])[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(value);
