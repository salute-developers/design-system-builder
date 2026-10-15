import type { Config, ResolvedStyleReference, Theme } from '../controllers';
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
    states: Array<{ names: string[]; value?: string | number; alpha?: number }>;
    adjustment?: string | number;
    /** Прозрачность 0..1 для literal/token значения; задаётся, только если редактор её поддерживает. */
    alpha?: number;
    /** Идентификатор вложенного стиля из `ComponentPreviewDraft.styles` вместо значения. */
    styleRef?: string;
    /** Идентификатор ресурса из `ComponentPreviewDraft.assets` вместо значения. */
    assetRef?: string;
}
/** Вложенный стиль компонента, на который ссылаются свойства через `styleRef`. */
export interface PreviewStyleDraft {
    id: string;
    componentId: string;
    properties: PreviewPropertyDraft[];
}
export interface PreviewThemeTokenDraft {
    id: string;
    type: 'color' | 'dimension' | 'shape' | 'typography' | 'fontFamily' | 'gradient' | 'shadow';
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
    /** Вложенные стили; пусто, пока редактор не умеет ссылок на стили. */
    styles?: PreviewStyleDraft[];
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

/** Разворачивает ссылку на стиль другого компонента в выбранные стили его конфигурации. */
export type StyleReferenceResolver = (reference: string) => ResolvedStyleReference | undefined;

const MAX_STYLE_REFERENCE_DEPTH = 5;

interface CollectContext {
    resolveStyleReference?: StyleReferenceResolver;
    /** Вложенные стили по идентификатору: им же свойства ссылаются через `styleRef`. */
    styles: Map<string, PreviewStyleDraft>;
}

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
    states: (prop.getStates() ?? []).map((state) => ({ names: state.state, value: state.value, alpha: state.alpha })),
    adjustment: prop.getAdjustment(),
    alpha: prop.getAlpha(),
});

/** Свойство-ссылка на стиль становится `styleRef`; не разворачиваемая ссылка (нет цели, цикл) пропускается. */
const projectWithReferences = (
    prop: PropUnion,
    context: CollectContext,
    trail: string[],
): PreviewPropertyDraft | undefined => {
    const projected = projectProperty(prop);
    if (prop.getType() !== 'component_style') return projected;

    const reference = String(prop.getValue() ?? '');
    const resolved = reference ? context.resolveStyleReference?.(reference) : undefined;
    if (!resolved || trail.length >= MAX_STYLE_REFERENCE_DEPTH || trail.includes(reference)) return;

    if (!context.styles.has(reference)) {
        // Запись создаётся до обхода: так ссылка стиля на самого себя не приводит к бесконечной рекурсии.
        const style: PreviewStyleDraft = { id: reference, componentId: resolved.config.getName(), properties: [] };
        context.styles.set(reference, style);
        const { invariants, selected } = collectProperties(resolved.config, resolved.selections, context, [
            ...trail,
            reference,
        ]);
        style.properties = [...invariants, ...selected];
    }

    return { ...projected, value: undefined, styleRef: reference };
};

/**
 * Свойства конфигурации при выбранных стилях: инварианты, значения выбранных стилей и значения сочетаний
 * стилей. Сочетание действует, когда выбраны все его стили; более полное сочетание перекрывает менее полное,
 * а любое сочетание — значение отдельного стиля.
 */
const collectProperties = (
    config: Config,
    selections: Record<string, string>,
    context: CollectContext,
    trail: string[],
) => {
    const project = (list: PropUnion[]) =>
        list.flatMap((prop) => projectWithReferences(prop, context, trail) ?? []);

    const byID = new Map<string, PropUnion>();
    for (const variation of config.getVariations()) {
        const styleID = selections[variation.getID()];
        if (!styleID) continue;
        variation
            .getStyle(styleID)
            ?.getProps()
            .getList()
            .forEach((prop) => byID.set(prop.getID(), prop));
    }
    const selectedIDs = new Set(Object.values(selections));
    config
        .getCombinations()
        .filter(({ styleIDs }) => styleIDs.length > 0 && styleIDs.every((id) => selectedIDs.has(id)))
        .sort((a, b) => a.styleIDs.length - b.styleIDs.length)
        .forEach(({ props }) => props.getList().forEach((prop) => byID.set(prop.getID(), prop)));

    return { invariants: project(config.getInvariants().getList()), selected: project([...byID.values()]) };
};

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
    /** Нужен компонентам со свойствами-ссылками на стили других компонентов (например, `ButtonGroup`). */
    resolveStyleReference?: StyleReferenceResolver;
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
    resolveStyleReference,
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
        // Выключенный флаг (`pilled`) в редакторе — отсутствие аргумента: при явном наборе выбранных вариаций
        // его нельзя возвращать к стилю по умолчанию.
        const flagIsOff =
            variation.isFlag() &&
            explicitVariationSelections !== undefined &&
            typeof explicitVariationSelections[variation.getName()] !== 'string';
        if (flagIsOff) continue;
        variationSelections[variation.getID()] = selected;
    }
    const context: CollectContext = { resolveStyleReference, styles: new Map() };
    const { invariants, selected: selectedStyleProperties } = collectProperties(config, variationSelections, context, []);
    const exampleProps = Object.fromEntries(
        Object.entries(explicitExampleProps ?? args)
            .filter(([name]) => explicitExampleProps !== undefined || !variationNames.has(name))
            .map(([name, value]) => [name, asJsonValue(value)]),
    );
    const themeTokens: PreviewThemeTokenDraft[] = [];
    for (const [type, tokens] of Object.entries(theme.getTokens())) {
        if (!['color', 'shape', 'spacing', 'typography', 'fontFamily', 'gradient', 'shadow'].includes(type)) continue;
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
            invariantProperties: invariants,
            selectedStyleProperties,
            themeTokens,
            assets,
            ...(context.styles.size ? { styles: [...context.styles.values()] } : {}),
            example: { id: metadata.storyId!, props: exampleProps },
            surface,
        },
    };
};
