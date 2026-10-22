import type {
    JsonValue,
    PreviewDefaults,
    PreviewAsset,
    PreviewPayloadInput,
    PreviewPropertySource,
    PreviewPropertyValue,
    PreviewStateEntry,
    PreviewStyle,
    PreviewThemeValue,
} from './types';
import type {
    AssemblyDiagnostic,
    ComponentPreviewDraft,
    PreviewPropertyDraft,
    PreviewStyleDraft,
    PreviewThemeTokenDraft,
} from './draft';

export type AssemblyResult =
    | { ok: true; payload: PreviewPayloadInput }
    | { ok: false; diagnostics: AssemblyDiagnostic[] };

const failure = (diagnostic: AssemblyDiagnostic): AssemblyResult => ({ ok: false, diagnostics: [diagnostic] });
const diagnostic = (code: AssemblyDiagnostic['code'], message: string, path?: string): AssemblyDiagnostic => ({
    code,
    message,
    path,
});
const stateName = (name: string) => (name === 'hover' || name === 'hovered' ? 'hovered' : name);

/**
 * Протокол не умеет поправку к токену, поэтому скорректированная форма передаётся производным токеном темы
 * `<токен>@adjust(<поправка>)`: его радиусы собираются из радиусов исходного токена при сборке темы.
 */
const ADJUSTED_TOKEN = /^(.+)@adjust\((-?\d+(?:\.\d+)?)\)$/;
const adjustedTokenId = (tokenId: string, adjustment: number) => `${tokenId}@adjust(${adjustment})`;
const parseAdjustedTokenId = (id: string) => {
    const match = ADJUSTED_TOKEN.exec(id);
    return match ? { baseId: match[1], adjustment: Number(match[2]) } : undefined;
};

const sourceFor = (
    property: PreviewPropertyDraft,
    raw: string | number | undefined,
    adjusted = false,
): PreviewPropertySource | AssemblyDiagnostic => {
    if (raw === undefined) return diagnostic('incompatible_value', `Property ${property.id} has no value`, property.id);
    const numeric = typeof raw === 'number' ? raw : Number(raw);
    if (!adjusted && (property.type === 'dimension' || property.type === 'float') && Number.isFinite(numeric)) {
        return { type: 'literal', value: numeric };
    }
    // Свойство типа `value` хранит значение без темы (имя константы enum, флаг): это литерал, а не токен.
    // Иконка — имя в формате данных (`disclosure.down.fill.16`); плагин находит по нему иконку, токена темы нет.
    if (!adjusted && (property.type === 'value' || property.type === 'icon')) return { type: 'literal', value: raw };
    if (!adjusted && typeof raw === 'string' && property.type !== 'float') {
        return { type: 'tokenRef', tokenId: raw };
    }
    const adjustment = adjusted ? Number(property.adjustment) : 0;
    // Форма хранится токеном, поправка (в пикселях) смещает его радиусы.
    if (adjusted && property.type === 'shape' && typeof raw === 'string' && Number.isFinite(adjustment)) {
        return { type: 'tokenRef', tokenId: adjustment === 0 ? raw : adjustedTokenId(raw, adjustment) };
    }
    if (property.adjustment !== undefined && !Number.isFinite(numeric + adjustment)) {
        return diagnostic('incompatible_value', `Adjustment for ${property.id} requires a number`, property.id);
    }
    return { type: 'literal', value: property.adjustment === undefined ? raw : numeric + adjustment };
};

const withAlpha = (
    source: PreviewPropertySource,
    alpha: number | undefined,
    path: string,
): PreviewPropertySource | AssemblyDiagnostic => {
    if (alpha === undefined) return source;
    if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
        return diagnostic('incompatible_value', `Alpha for ${path} must be between 0 and 1`, path);
    }
    return source.type === 'literal' || source.type === 'tokenRef' ? { ...source, alpha } : source;
};

/** Иконка без значения в payload не попадает: компонент рисуется с иконкой по умолчанию. */
const isEmptyIcon = (property: PreviewPropertyDraft) =>
    property.type === 'icon' && (property.value === undefined || property.value === '');

const effectiveProperty = (property: PreviewPropertyDraft): PreviewPropertyValue | AssemblyDiagnostic => {
    if (property.styleRef) return { base: { type: 'styleRef', styleId: property.styleRef } };
    if (property.assetRef) return { base: { type: 'assetRef', assetId: property.assetRef } };
    const plainBase = sourceFor(property, property.value, property.adjustment !== undefined);
    if ('code' in plainBase) return plainBase;
    const base = withAlpha(plainBase, property.alpha, property.id);
    if ('code' in base) return base;
    const states: PreviewStateEntry[] = [];
    // В конфигурации (как в Android ColorStateList) побеждает первое совпадение, а в протоколе при равном числе состояний
    // последняя запись: порядок разворачивается, чтобы `pressed` перед `hovered` выигрывал при нажатии с наведением.
    for (const { names, value, alpha } of [...property.states].reverse()) {
        const plain = sourceFor(property, value, property.adjustment !== undefined);
        if ('code' in plain) continue;
        const source = withAlpha(plain, alpha, property.id);
        if ('code' in source) return source;
        const when = [...new Set(names.filter(Boolean).map(stateName))];
        if (!when.length) continue;
        states.push({ when, source });
    }
    return { base, ...(states.length ? { states } : {}) };
};

const sourcesOf = (property: PreviewPropertyValue) => [
    property.base,
    ...(property.states ?? []).map((entry) => entry.source),
];

interface CollectedStyles {
    styles: Record<string, PreviewStyle>;
    error?: AssemblyDiagnostic;
}

/** Собирает транзитивно достижимые вложенные стили, проверяя неизвестные ссылки и циклы. */
const collectStyles = (roots: Record<string, PreviewPropertyValue>, drafts: PreviewStyleDraft[]): CollectedStyles => {
    const index = new Map(drafts.map((style) => [style.id, style]));
    const styles: Record<string, PreviewStyle> = {};
    const stack: string[] = [];
    const visit = (properties: Record<string, PreviewPropertyValue>): AssemblyDiagnostic | undefined => {
        for (const value of Object.values(properties)) {
            for (const source of sourcesOf(value)) {
                if (source.type !== 'styleRef') continue;
                const id = source.styleId;
                if (stack.includes(id)) {
                    return diagnostic('cycle', `Style reference cycle: ${[...stack, id].join(' -> ')}`, id);
                }
                if (styles[id]) continue;
                const draftStyle = index.get(id);
                if (!draftStyle) return diagnostic('invalid_reference', `Style ${id} is missing`, id);
                const nested: Record<string, PreviewPropertyValue> = {};
                for (const property of draftStyle.properties) {
                    if (isEmptyIcon(property)) continue;
                    const effective = effectiveProperty(property);
                    if ('code' in effective) return effective;
                    nested[property.name] = effective;
                }
                stack.push(id);
                const error = visit(nested);
                stack.pop();
                if (error) return error;
                styles[id] = { component: draftStyle.componentId, properties: nested };
            }
        }
    };
    const error = visit(roots);
    return { styles, error };
};

/** Имя токена без разделителей и регистра: `solid.default` и `solid-default` дают один ключ. */
const looseTokenKey = (id: string) => id.replace(/[.-]/g, '').toLowerCase();

const comparable = (value: PreviewPropertyValue) => JSON.stringify(value);
const numberFrom = (value: unknown) => {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return Number.NaN;
    return Number.parseFloat(value);
};
const colorFrom = (value: unknown) => {
    if (typeof value !== 'string') return;
    if (/^#[0-9a-f]{8}$/i.test(value)) return value.toUpperCase();
    if (/^#[0-9a-f]{6}$/i.test(value)) return `${value.toUpperCase()}FF`;
};

export const assembleComposePreviewPayload = (draft: ComponentPreviewDraft): AssemblyResult => {
    const result = assemble(draft);
    // Стили по умолчанию вспомогательные: недоступный токен или стиль не должен ломать превью самого компонента.
    if (result.ok || !draft.defaults) return result;

    return assemble({ ...draft, defaults: undefined });
};

const assemble = (draft: ComponentPreviewDraft): AssemblyResult => {
    const properties: Record<string, PreviewPropertyValue> = {};
    const propertySources: Record<string, string> = {};
    for (const property of [...draft.selectedStyleProperties, ...draft.invariantProperties]) {
        if (isEmptyIcon(property)) continue;
        if (!property.composeParameters.length) {
            if (property.hasNonComposeMappings) continue;
            return failure(
                diagnostic('missing_mapping', `Property ${property.id} has no Compose mapping`, property.id),
            );
        }
        const effective = effectiveProperty(property);
        if ('code' in effective) return failure(effective);
        const previousPropertyId = propertySources[property.name];
        if (
            properties[property.name] &&
            previousPropertyId !== property.id &&
            comparable(properties[property.name]) !== comparable(effective)
        ) {
            return failure({
                ...diagnostic(
                    'property_conflict',
                    `Component property ${property.name} has conflicting sources: ${previousPropertyId} and ${property.id}`,
                    property.name,
                ),
                details: {
                    propertyName: property.name,
                    sourcePropertyIds: [previousPropertyId, property.id],
                },
            });
        }
        properties[property.name] = effective;
        propertySources[property.name] = property.id;
    }

    // Стили по умолчанию собираются так же, как вложенные: ссылка на стиль из корня достаёт его и его токены.
    const defaultStyleRoots: Record<string, PreviewPropertyValue> = Object.fromEntries(
        defaultStyleEntries(draft.defaults?.styles).flatMap(([kind, styleId]) =>
            styleId ? [[`defaults.${kind}`, { base: { type: 'styleRef', styleId } } as PreviewPropertyValue]] : [],
        ),
    );
    const collected = collectStyles({ ...properties, ...defaultStyleRoots }, draft.styles ?? []);
    if (collected.error) return failure(collected.error);
    const roots = new Set<string>();
    const assets = new Map<string, PreviewAsset>();
    for (const property of [
        ...Object.values(properties),
        ...Object.values(collected.styles).flatMap((style) => Object.values(style.properties)),
    ]) {
        for (const source of sourcesOf(property)) {
            if (source.type === 'tokenRef') roots.add(source.tokenId);
            if (source.type === 'assetRef') {
                const asset = draft.assets.find((item) => item.id === source.assetId);
                if (!asset) {
                    return failure(diagnostic('missing_asset', `Asset ${source.assetId} is missing`, source.assetId));
                }
                assets.set(asset.id, asset);
            }
        }
    }

    const tokenIndex = new Map(draft.themeTokens.map((token) => [token.id, token]));
    // Compose-конфигурации пишут `surface.on-dark.solid.default`, а в теме токен называется `solid-default`:
    // имя без учёта разделителей находит единственный токен. Неоднозначное имя токеном не считается.
    const looseIndex = new Map<string, PreviewThemeTokenDraft[]>();
    for (const token of draft.themeTokens) {
        const key = looseTokenKey(token.id);
        looseIndex.set(key, [...(looseIndex.get(key) ?? []), token]);
    }
    const findLoose = (id: string) => {
        const matches = looseIndex.get(looseTokenKey(id));
        return matches?.length === 1 ? matches[0] : undefined;
    };
    const theme: Record<string, PreviewThemeValue> = {};
    const visiting: string[] = [];

    const resolve = (requestedId: string): AssemblyDiagnostic | undefined => {
        if (theme[requestedId]) return;
        const adjusted = parseAdjustedTokenId(requestedId);
        if (adjusted) {
            const error = resolve(adjusted.baseId);
            if (error) return error;
            const base = theme[adjusted.baseId];
            if (base?.type !== 'shape') {
                return diagnostic(
                    'incompatible_value',
                    `Adjustment for ${adjusted.baseId} requires a shape token`,
                    adjusted.baseId,
                );
            }
            const radii = base.cornerRadii.map((radius) => Math.max(0, radius + adjusted.adjustment));
            theme[requestedId] = { type: 'shape', cornerRadii: radii as [number, number, number, number] };
            return;
        }
        if (visiting.includes(requestedId)) {
            return diagnostic(
                'cycle',
                `Theme reference cycle: ${[...visiting, requestedId].join(' -> ')}`,
                requestedId,
            );
        }
        const referenceAlias = requestedId.startsWith('fontFamily.')
            ? requestedId.slice('fontFamily.'.length)
            : undefined;
        const candidates = [
            requestedId,
            `${draft.themeMode}.${requestedId}`,
            `screen-s.${requestedId}`,
            referenceAlias,
        ].filter((id): id is string => Boolean(id));
        const token =
            candidates.map((id) => tokenIndex.get(id)).find(Boolean) ?? candidates.map(findLoose).find(Boolean);
        if (!token) return diagnostic('missing_token', `Theme token ${requestedId} is missing`, requestedId);
        if (!token.enabled) return diagnostic('disabled_token', `Theme token ${token.id} is disabled`, token.id);
        const raw = token.values[draft.themeValuePlatform];
        if (raw === undefined || raw === null) {
            return diagnostic(
                'missing_token',
                `Theme token ${token.id} has no ${draft.themeValuePlatform} value`,
                token.id,
            );
        }
        visiting.push(requestedId);
        const normalized = normalizeToken(token, raw, resolve, draft.assets, assets);
        visiting.pop();
        if ('code' in normalized) return normalized;
        theme[requestedId] = normalized;
    };
    for (const root of roots) {
        const error = resolve(root);
        if (error) return failure(error);
    }
    const defaults = buildDefaults(draft.defaults, collected.styles, resolve);
    return {
        ok: true,
        payload: {
            protocolVersion: 1,
            platform: 'COMPOSE',
            assets: [...assets.values()].sort((a, b) => a.id.localeCompare(b.id)),
            theme,
            component: {
                id: draft.componentId,
                variations: { ...draft.variationSelections },
                properties,
            },
            ...(Object.keys(collected.styles).length ? { styles: collected.styles } : {}),
            ...(defaults ? { defaults } : {}),
            example: draft.example,
            surface: draft.surface,
        },
    };
};

const defaultStyleEntries = (styles: object | undefined) =>
    Object.entries(styles ?? {}) as Array<[string, string | undefined]>;

/** Стили по умолчанию, присутствующие в `styles`, и токены текста, которые нашлись в теме. */
const buildDefaults = (
    defaults: ComponentPreviewDraft['defaults'],
    styles: Record<string, PreviewStyle>,
    resolve: (id: string) => AssemblyDiagnostic | undefined,
): PreviewDefaults | undefined => {
    if (!defaults) return undefined;

    const text: NonNullable<PreviewDefaults['text']> = {};
    for (const key of ['style', 'color'] as const) {
        const tokenId = defaults.text?.[key];
        if (tokenId && !resolve(tokenId)) text[key] = tokenId;
    }
    const resolvedStyles = Object.fromEntries(
        defaultStyleEntries(defaults.styles).filter(([, styleId]) => styleId && styles[styleId]),
    ) as NonNullable<PreviewDefaults['styles']>;

    return Object.keys(text).length || Object.keys(resolvedStyles).length
        ? {
              ...(Object.keys(text).length ? { text } : {}),
              ...(Object.keys(resolvedStyles).length ? { styles: resolvedStyles } : {}),
          }
        : undefined;
};

const normalizeToken = (
    token: PreviewThemeTokenDraft,
    raw: JsonValue,
    resolve: (id: string) => AssemblyDiagnostic | undefined,
    availableAssets: PreviewAsset[],
    assets: Map<string, PreviewAsset>,
): PreviewThemeValue | AssemblyDiagnostic => {
    if (token.type === 'color') {
        const value = colorFrom(raw);
        return value
            ? { type: 'color', value }
            : diagnostic('incompatible_value', `Invalid color value for ${token.id}`, token.id);
    }
    if (token.type === 'dimension') {
        const value = numberFrom(raw && typeof raw === 'object' && !Array.isArray(raw) ? raw.value : raw);
        return Number.isFinite(value)
            ? { type: 'dimension', value }
            : diagnostic('incompatible_value', `Invalid dimension value for ${token.id}`, token.id);
    }
    if (token.type === 'shape') {
        const radius = numberFrom(
            raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw.cornerRadius ?? raw.value) : raw,
        );
        return Number.isFinite(radius)
            ? { type: 'shape', cornerRadii: [radius, radius, radius, radius] }
            : diagnostic('incompatible_value', `Invalid shape value for ${token.id}`, token.id);
    }
    if (token.type === 'shadow') return normalizeShadow(token, raw);
    if (token.type === 'gradient') return normalizeGradient(token, raw);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return diagnostic('incompatible_value', `Invalid ${token.type} value for ${token.id}`, token.id);
    }
    if (token.type === 'typography') {
        const ref = String(raw.fontFamilyRef ?? raw.fontFamilyTokenId ?? '');
        if (!ref) return diagnostic('invalid_reference', `Typography ${token.id} has no font family`, token.id);
        const error = resolve(ref);
        if (error) return error;
        const value = {
            type: 'typography' as const,
            fontFamilyTokenId: ref,
            fontSize: numberFrom(raw.fontSize ?? raw.textSize ?? raw.size),
            lineHeight: numberFrom(raw.lineHeight),
            letterSpacing: numberFrom(raw.letterSpacing ?? raw.kerning ?? 0),
            weight: numberFrom(raw.fontWeight ?? raw.weight),
        };
        return Object.values(value).some((part) => typeof part === 'number' && !Number.isFinite(part))
            ? diagnostic('incompatible_value', `Invalid typography value for ${token.id}`, token.id)
            : value;
    }
    const fonts = Array.isArray(raw.fonts) ? raw.fonts : [];
    const faces: Array<{ assetId: string; weight: number; style: 'NORMAL' | 'ITALIC' }> = [];
    for (const font of fonts) {
        if (!font || typeof font !== 'object' || Array.isArray(font)) continue;
        const url = String(font.link ?? (Array.isArray(font.src) ? font.src[0] : '') ?? '');
        if (!url) return diagnostic('missing_asset', `Font ${token.id} has no asset URL`, token.id);
        const fontType = /\.otf(?:$|[?#])/i.test(url) ? 'OTF' : /\.ttf(?:$|[?#])/i.test(url) ? 'TTF' : undefined;
        if (!fontType) {
            return diagnostic('missing_asset', `Font ${token.id} has unsupported asset format`, token.id);
        }
        const asset = availableAssets.find((item) => item.url === url) ?? {
            id: `${token.id}:${faces.length}`,
            type: fontType,
            url,
        };
        assets.set(asset.id, asset);
        faces.push({
            assetId: asset.id,
            weight: numberFrom(font.fontWeight ?? font.weight),
            style: String(font.fontStyle ?? font.style ?? 'normal').toUpperCase() === 'ITALIC' ? 'ITALIC' : 'NORMAL',
        });
    }
    return { type: 'fontFamily', faces, allowFallback: fonts.length === 0 };
};

const objectsOf = (raw: JsonValue): Array<{ [key: string]: JsonValue }> =>
    (Array.isArray(raw) ? raw : [raw]).filter(
        (item): item is { [key: string]: JsonValue } => !!item && typeof item === 'object' && !Array.isArray(item),
    );

const normalizeShadow = (token: PreviewThemeTokenDraft, raw: JsonValue): PreviewThemeValue | AssemblyDiagnostic => {
    const layers = objectsOf(raw).map((layer) => ({
        x: numberFrom(layer.offsetX ?? layer.x ?? 0),
        y: numberFrom(layer.offsetY ?? layer.y ?? 0),
        blur: numberFrom(layer.blurRadius ?? layer.blur ?? 0),
        spread: numberFrom(layer.spreadRadius ?? layer.spread ?? 0),
        color: colorFrom(layer.color),
    }));
    if (
        !layers.length ||
        layers.some(
            (layer) =>
                layer.color === undefined ||
                Object.values(layer).some((v) => typeof v === 'number' && !Number.isFinite(v)),
        )
    ) {
        return diagnostic('incompatible_value', `Invalid shadow value for ${token.id}`, token.id);
    }
    return { type: 'shadow', layers: layers.map((layer) => ({ ...layer, color: layer.color! })) };
};

const normalizeGradient = (token: PreviewThemeTokenDraft, raw: JsonValue): PreviewThemeValue | AssemblyDiagnostic => {
    const layers = objectsOf(raw).map((layer) => {
        if (layer.kind !== 'linear') return undefined;
        const colors = Array.isArray(layer.colors) ? layer.colors.map(colorFrom) : [];
        const locations = Array.isArray(layer.locations) ? layer.locations.map(numberFrom) : [];
        const angle = numberFrom(layer.angle ?? 0);
        const valid =
            colors.length >= 2 &&
            colors.length === locations.length &&
            colors.every((color) => color !== undefined) &&
            locations.every((position) => Number.isFinite(position) && position >= 0 && position <= 1) &&
            Number.isFinite(angle);
        return valid
            ? {
                  kind: 'linear' as const,
                  angle,
                  stops: colors.map((color, i) => ({ color: color!, position: locations[i] })),
              }
            : undefined;
    });
    if (!layers.length || layers.some((layer) => !layer)) {
        return diagnostic('incompatible_value', `Invalid gradient value for ${token.id}`, token.id);
    }
    return { type: 'gradient', layers: layers as NonNullable<(typeof layers)[number]>[] };
};
