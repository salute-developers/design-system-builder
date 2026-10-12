import type { Config, Theme } from '../controllers';
import type { PropType, PropUnion } from '../controllers/componentBuilder/type';
import type { JsonValue, PreviewAsset, PreviewSurface } from './types';
import { getRestoredColorFromPalette } from '@salutejs/plasma-tokens-utils';

export type ThemeValuePlatform = 'web' | 'android' | 'ios';
export interface PreviewPropertyDraft {
    id: string;
    name: string;
    type: PropType;
    composeParameters: string[];
    hasNonComposeMappings?: boolean;
    value?: string | number;
    states: Array<{ names: string[]; value?: string | number }>;
    adjustment?: string | number;
}
export interface PreviewThemeTokenDraft {
    id: string;
    type: 'color' | 'dimension' | 'shape' | 'typography' | 'fontFamily';
    enabled: boolean;
    values: Partial<Record<ThemeValuePlatform, JsonValue>>;
}
export interface ComponentPreviewDraft {
    componentId: string;
    storyId: string;
    rendererPlatform: 'COMPOSE';
    themeValuePlatform: ThemeValuePlatform;
    themeMode: string;
    componentRevision: number;
    themeRevision: number;
    variationSelections: Record<string, string>;
    invariantProperties: PreviewPropertyDraft[];
    selectedStyleProperties: PreviewPropertyDraft[];
    themeTokens: PreviewThemeTokenDraft[];
    assets: PreviewAsset[];
    example: { id: string; props: Record<string, JsonValue> };
    surface: PreviewSurface;
}
export interface AssemblyDiagnostic {
    code:
        | 'missing_metadata'
        | 'missing_mapping'
        | 'missing_token'
        | 'disabled_token'
        | 'invalid_reference'
        | 'cycle'
        | 'incompatible_value'
        | 'property_conflict'
        | 'missing_asset';
    message: string;
    path?: string;
    details?: Record<string, JsonValue>;
}
export type DraftResult =
    | { ok: true; draft: ComponentPreviewDraft }
    | { ok: false; diagnostics: AssemblyDiagnostic[] };

const splitComposeMapping = (mapping?: string | null) =>
    mapping
        ?.split(',')
        .map((value) => value.trim())
        .filter(Boolean) ?? [];

const projectProperty = (prop: PropUnion): PreviewPropertyDraft => ({
    id: prop.getID(),
    name: prop.getName(),
    type: prop.getType()!,
    composeParameters: splitComposeMapping(prop.getPlatformMappings()?.compose),
    hasNonComposeMappings: Boolean(
        prop.getPlatformMappings()?.web?.length ||
            prop.getPlatformMappings()?.xml ||
            prop.getPlatformMappings()?.ios,
    ),
    value: prop.getValue(),
    states: (prop.getStates() ?? []).map((state) => ({ names: state.state, value: state.value })),
    adjustment: prop.getAdjustment(),
});

const asJsonValue = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue;
const projectThemeValue = (type: string, value: unknown): JsonValue => {
    if (type === 'color' && typeof value === 'string') {
        return getRestoredColorFromPalette(value, -1) || value;
    }
    return asJsonValue(value);
};

export interface CreateComponentPreviewDraftOptions {
    config: Config;
    theme: Theme;
    previewMetadata?: {
        componentId?: string;
        storyId?: string;
    };
    args: Record<string, unknown>;
    variationSelections?: Record<string, unknown>;
    exampleProps?: Record<string, unknown>;
    themeMode: string;
    themeValuePlatform: ThemeValuePlatform;
    surface: PreviewSurface;
    assets?: PreviewAsset[];
}

export const createComponentPreviewDraft = ({
    config,
    theme,
    previewMetadata,
    args,
    variationSelections: explicitVariationSelections,
    exampleProps: explicitExampleProps,
    themeMode,
    themeValuePlatform,
    surface,
    assets = [],
}: CreateComponentPreviewDraftOptions): DraftResult => {
    const metadata = previewMetadata ?? config.getPreviewMetadata();
    const diagnostics: AssemblyDiagnostic[] = [];
    if (!metadata.componentId || !metadata.storyId) {
        diagnostics.push({
            code: 'missing_metadata',
            message: 'Stable Compose component/story metadata is unavailable',
        });
    }

    const variationSelections: Record<string, string> = {};
    const variationNames = new Set<string>();
    const selectedStyleProperties: PreviewPropertyDraft[] = [];
    for (const variation of config.getVariations()) {
        variationNames.add(variation.getName());
        const selected =
            (typeof explicitVariationSelections?.[variation.getName()] === 'string'
                ? explicitVariationSelections[variation.getName()]
                : typeof args[variation.getName()] === 'string'
                  ? args[variation.getName()]
                  : undefined) ??
            config.getDefaults().find((item) => item.getVariationID() === variation.getID())?.getStyleID();
        if (typeof selected !== 'string') continue;
        variationSelections[variation.getID()] = selected;
        variation
            .getStyle(selected)
            ?.getProps()
            .getList()
            .forEach((prop) => selectedStyleProperties.push(projectProperty(prop)));
    }
    const exampleProps = Object.fromEntries(
        Object.entries(explicitExampleProps ?? args)
            .filter(([name]) => explicitExampleProps !== undefined || !variationNames.has(name))
            .map(([name, value]) => [name, asJsonValue(value)]),
    );
    const themeTokens: PreviewThemeTokenDraft[] = [];
    for (const [type, tokens] of Object.entries(theme.getTokens())) {
        if (!['color', 'shape', 'spacing', 'typography', 'fontFamily'].includes(type)) continue;
        for (const token of tokens) {
            themeTokens.push({
                id: token.getName(),
                type: type === 'spacing' ? 'dimension' : (type as PreviewThemeTokenDraft['type']),
                enabled: token.getEnabled(),
                values: {
                    web: projectThemeValue(type, token.getValue('web')),
                    android: projectThemeValue(type, token.getValue('android')),
                    ios: projectThemeValue(type, token.getValue('ios')),
                },
            });
        }
    }
    if (diagnostics.length) return { ok: false, diagnostics };
    return {
        ok: true,
        draft: {
            componentId: metadata.componentId!,
            storyId: metadata.storyId!,
            rendererPlatform: 'COMPOSE',
            themeValuePlatform,
            themeMode,
            componentRevision: config.getRevision(),
            themeRevision: theme.getRevision(),
            variationSelections,
            invariantProperties: config.getInvariants().getList().map(projectProperty),
            selectedStyleProperties,
            themeTokens,
            assets,
            example: { id: metadata.storyId!, props: exampleProps },
            surface,
        },
    };
};
