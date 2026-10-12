import type {
    JsonValue,
    PreviewAsset,
    PreviewPayloadInput,
    PreviewPropertySource,
    PreviewPropertyValue,
    PreviewThemeValue,
} from './types';
import type {
    AssemblyDiagnostic,
    ComponentPreviewDraft,
    PreviewPropertyDraft,
    PreviewThemeTokenDraft,
} from './draft';

export type AssemblyResult =
    | { ok: true; payload: PreviewPayloadInput }
    | { ok: false; diagnostics: AssemblyDiagnostic[] };

const failure = (diagnostic: AssemblyDiagnostic): AssemblyResult => ({ ok: false, diagnostics: [diagnostic] });
const diagnostic = (
    code: AssemblyDiagnostic['code'],
    message: string,
    path?: string,
): AssemblyDiagnostic => ({ code, message, path });
const stateName = (name: string) => (name === 'hover' || name === 'hovered' ? 'hovered' : name);

const sourceFor = (
    property: PreviewPropertyDraft,
    raw: string | number | undefined,
    adjusted = false,
): PreviewPropertySource | AssemblyDiagnostic => {
    if (raw === undefined) return diagnostic('incompatible_value', `Property ${property.id} has no value`, property.id);
    const numeric = typeof raw === 'number' ? raw : Number(raw);
    if (
        !adjusted &&
        (property.type === 'dimension' || property.type === 'float') &&
        Number.isFinite(numeric)
    ) {
        return { type: 'literal', value: numeric };
    }
    if (!adjusted && typeof raw === 'string' && property.type !== 'float') {
        return { type: 'tokenRef', tokenId: raw };
    }
    const adjustment = adjusted ? Number(property.adjustment) : 0;
    if (property.adjustment !== undefined && !Number.isFinite(numeric + adjustment)) {
        return diagnostic('incompatible_value', `Adjustment for ${property.id} requires a number`, property.id);
    }
    return { type: 'literal', value: property.adjustment === undefined ? raw : numeric + adjustment };
};

const effectiveProperty = (property: PreviewPropertyDraft): PreviewPropertyValue | AssemblyDiagnostic => {
    const base = sourceFor(property, property.value, property.adjustment !== undefined);
    if ('code' in base) return base;
    const states = Object.fromEntries(
        property.states.flatMap(({ names, value }) => {
            const source = sourceFor(property, value, property.adjustment !== undefined);
            return 'code' in source ? [] : names.map((name) => [stateName(name), source]);
        }),
    );
    return { base, ...(Object.keys(states).length ? { states } : {}) };
};

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
    const properties: Record<string, PreviewPropertyValue> = {};
    const propertySources: Record<string, string> = {};
    for (const property of [...draft.selectedStyleProperties, ...draft.invariantProperties]) {
        if (!property.composeParameters.length) {
            if (property.hasNonComposeMappings) continue;
            return failure(diagnostic('missing_mapping', `Property ${property.id} has no Compose mapping`, property.id));
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

    const roots = new Set<string>();
    for (const property of Object.values(properties)) {
        for (const source of [property.base, ...Object.values(property.states ?? {})]) {
            if (source.type === 'tokenRef') roots.add(source.tokenId);
        }
    }

    const tokenIndex = new Map(draft.themeTokens.map((token) => [token.id, token]));
    const theme: Record<string, PreviewThemeValue> = {};
    const assets = new Map<string, PreviewAsset>();
    const visiting: string[] = [];

    const resolve = (requestedId: string): AssemblyDiagnostic | undefined => {
        if (theme[requestedId]) return;
        if (visiting.includes(requestedId)) {
            return diagnostic('cycle', `Theme reference cycle: ${[...visiting, requestedId].join(' -> ')}`, requestedId);
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
        const token = candidates.map((id) => tokenIndex.get(id)).find(Boolean);
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
            example: draft.example,
            surface: draft.surface,
        },
    };
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
            raw && typeof raw === 'object' && !Array.isArray(raw) ? raw.cornerRadius ?? raw.value : raw,
        );
        return Number.isFinite(radius)
            ? { type: 'shape', cornerRadii: [radius, radius, radius, radius] }
            : diagnostic('incompatible_value', `Invalid shape value for ${token.id}`, token.id);
    }
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
        const fontType = /\.otf(?:$|[?#])/i.test(url)
            ? 'OTF'
            : /\.ttf(?:$|[?#])/i.test(url)
              ? 'TTF'
              : undefined;
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
            style: String(font.fontStyle ?? font.style ?? 'normal').toUpperCase() === 'ITALIC'
                ? 'ITALIC'
                : 'NORMAL',
        });
    }
    return { type: 'fontFamily', faces, allowFallback: fonts.length === 0 };
};
