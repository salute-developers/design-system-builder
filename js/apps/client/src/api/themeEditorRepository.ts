import { http, PROJECTS_URL } from '.';
import type {
    ComponentConfig,
    Meta,
    PlatformsVariations,
    ThemeMeta,
    ThemeSource,
    TokenType,
    VariationType,
} from '../controllers';
import type { Parameters } from '../types';
import { getComposePreviewPluginUrl, hasConfiguration, markComposeComponents } from '../composePreview';
import { isComponentEditorEnabled } from '../utils/featureFlags';

import type { DesignSystemDto, ProjectDto, ProjectMemberDto, TenantDto } from './contracts';
import type { TokenChange } from '../utils/designSystemDraft';
import { componentChanges, type ComponentChange } from './componentAutosave';

export interface EditorContextKey {
    projectId: string;
    designSystemId: string;
    tenantId: string;
    versionId?: string;
}
export interface TokenDefinitionDto {
    id: string;
    designSystemId: string;
    name: string;
    type: VariationType;
    displayName: string | null;
    description: string | null;
    enabled: boolean;
    /** Группа или подгруппа токенов; у старого ds-service поля нет. */
    groupId?: string | null;
    position?: number;
    /** Последняя опубликованная версия с этим определением. */
    publishedIn?: string | null;
}
export interface TenantTokenValueDto {
    id: string;
    tokenId: string;
    tenantId: string;
    platform: 'web' | 'ios' | 'android' | null;
    mode: 'light' | 'dark' | null;
    paletteId?: string | null;
    /** Исходная ссылка на палитру: ds-service отдаёт в `value` цвет по палитре темы, а ссылку — здесь. */
    paletteRef?: string | null;
    value: unknown;
    editRevision: number;
}
export type TenantTokenValueInputDto = Pick<
    TenantTokenValueDto,
    'tokenId' | 'platform' | 'mode' | 'paletteId' | 'value'
> & { baseRevision: number };
interface PaletteDto {
    id: string;
    type: 'general' | 'additional';
    shade: string;
    saturation: number;
}
interface ComponentDto {
    id: string;
    name: string;
    description: string | null;
    platform: 'web' | 'compose' | 'xml' | 'ios';
}
interface DesignSystemComponentDto {
    id: string;
    designSystemId: string;
    componentId: string;
}
interface AppearanceDto {
    id: string;
    designSystemId: string;
    componentId: string;
    name: string | null;
}
interface ComponentPropertyDto {
    id: string;
    name: string;
    type: string;
    description: string | null;
}
interface ComponentVariationDto {
    id: string;
    name: string;
}
interface ComponentStyleDto {
    id: string;
    variationId: string;
    name: string;
}
interface AppearanceVariationDto {
    id: string;
    appearanceId: string;
    variationId: string;
    defaultStyleId: string | null;
}
interface AppearanceVariationValueDto {
    id: string;
    appearanceVariationId: string;
    styleId: string;
    position: number;
}
interface ComponentStateDto {
    id: string;
    name: string;
}
interface ComponentStateSetDto {
    id: string;
    stateIds: string[];
}
interface PropertyValueDto {
    id: string;
    propertyId: string;
    appearanceId: string;
    styleId?: string;
    tokenId: string | null;
    value: string | null;
    adjustment: string | null;
    stateSetId: string;
}
interface ComponentConfigPropertyDto {
    id?: string;
    type: string;
    default?: unknown;
    value?: unknown;
    adjustment?: unknown;
    states?: Array<{ state: string[]; value: unknown }>;
}
interface ComponentConfigDto {
    invariants: Record<string, ComponentConfigPropertyDto>;
    defaults: Array<{ id: string; value: unknown }>;
    variations: Array<{
        id: string;
        name: string;
        values: Array<{ name: string; properties: Record<string, ComponentConfigPropertyDto> }>;
    }>;
}
interface ComponentConfigExportDto {
    components: Array<{ componentName: string; styleName: string; config: ComponentConfigDto }>;
}
export interface ThemeEditorTokenSnapshot {
    tenant: TenantDto;
    themeData: ThemeSource;

    editRevision: number;
    incompleteTokenIds: string[];
    tokenDefinitions: TokenDefinitionDto[];
    tokenIdsByName: Record<string, string>;
    tokenDefinitionsByName?: Record<string, TokenDefinitionDto>;
    tokenValueRevisionsByKey: Record<string, number>;
    publicationVersion: string;
}

export interface ThemeEditorSnapshot extends ThemeEditorTokenSnapshot {
    designSystem: DesignSystemDto;
    componentsData: Meta[];
    parameters: Partial<Parameters>;
}

export interface DesignSystemVersionDto {
    id: string;
    designSystemId: string;
    sequenceNumber: number;
    revision: number;
    version: string;
    changelog: string;
    publishedAt: string;
}

export interface DraftChangeDto {
    changeId: string;
    versionId: string;
    entityType: string;
    entityId: string;
    operation: 'created' | 'updated' | 'deleted';
    changedPaths: string[];
    previousValue: Record<string, unknown> | null;
    currentValue: Record<string, unknown> | null;
    actorId: string | null;
    changedAt: string;
    editRevision: number;
}

export interface PendingTokenMutation {
    tokenName: string;
    previousTokenName?: string;
    change: TokenChange;
    kind: 'create' | 'update' | 'rename' | 'delete';
    definitionPatch?: Partial<Pick<TokenDefinitionDto, 'name' | 'displayName' | 'description' | 'enabled'>>;
}

export interface PendingComponentMutation {
    componentName: string;
    before: ComponentConfig;
    after: ComponentConfig;
    idempotencyKeys: Record<string, string>;
}

const apiRoot = (projectId: string) => `${PROJECTS_URL}/${projectId}/ds`;
const tokenValueKey = (tokenId: string, platform: string | null, mode: string | null) =>
    `${tokenId}:${platform ?? ''}:${mode ?? ''}`;
const unwrapValue = (value: unknown): unknown => (Array.isArray(value) && value.length === 1 ? value[0] : value);
const normalizeComponentName = (name: string) => name.replace(/[-_\s]/g, '').toLowerCase();
const applySequentially = async <T>(items: T[], apply: (item: T) => Promise<void>) => {
    for (const item of items) await apply(item);
};
const legacyScalar = (value: unknown): string | number | undefined => {
    const unwrapped = unwrapValue(value);
    if (['string', 'number'].includes(typeof unwrapped)) return unwrapped as string | number;
    return unwrapped == null ? undefined : JSON.stringify(unwrapped);
};

const toLegacyComponentConfig = (
    config: ComponentConfigDto,
    propertyByName: Map<string, ComponentPropertyDto>,
    variationByName: Map<string, ComponentVariationDto>,
    stylesByVariation: Map<string, ComponentStyleDto[]>,
): Meta['sources']['configs'][number]['config'] => {
    const property = (name: string, value: ComponentConfigPropertyDto) => ({
        id: value.id ?? propertyByName.get(name)?.id ?? name,
        value: legacyScalar(value.default ?? value.value),
        adjustment: legacyScalar(value.adjustment),
        states: value.states?.map((state) => ({
            state: state.state as never,
            value: legacyScalar(state.value)?.toString(),
        })),
    });
    const variations = config.variations.map((axis) => {
        const variation = variationByName.get(axis.name) ?? variationByName.get(axis.id);
        const variationId = variation?.id ?? axis.id;
        const styles = stylesByVariation.get(variationId) ?? [];
        return {
            id: variationId,
            styles: axis.values.map((value) => ({
                id: styles.find((style) => style.name === value.name)?.id ?? value.name,
                name: value.name,
                intersections: null,
                props: Object.entries(value.properties).map(([name, item]) => property(name, item)),
            })),
        };
    });
    return {
        defaultVariations: config.defaults.map((item) => {
            const variation = variationByName.get(item.id);
            const variationId = variation?.id ?? item.id;
            const styleName = String(unwrapValue(item.value) ?? '');
            return {
                variationID: variationId,
                styleID: stylesByVariation.get(variationId)?.find((style) => style.name === styleName)?.id ?? styleName,
            };
        }),
        invariantProps: Object.entries(config.invariants).map(([name, item]) => property(name, item)),
        variations,
    };
};

export class ThemeEditorRepository {
    /**
     * Compose-компоненты нужны только Compose-preview: без плагина их не запрашиваем, а сбой запроса
     * не должен ломать редактор web-компонентов.
     */
    private async loadComposeComponents(root: string, designSystemName: string, signal?: AbortSignal) {
        if (!isComponentEditorEnabled() || !getComposePreviewPluginUrl()) return [];
        try {
            const response = await http.get<Meta[]>(
                `${root}/legacy/design-systems/${encodeURIComponent(designSystemName)}/component-configs`,
                { params: { platform: 'compose' }, signal },
            );
            // Компоненты без конфигурации в дизайн-системе в редакторе не показываются: стилей для них нет.
            return markComposeComponents(response.data.filter(hasConfiguration));
        } catch (error) {
            if (signal?.aborted) throw error;
            console.error('[ThemeEditorRepository] Не удалось загрузить Compose-компоненты', error);
            return [];
        }
    }

    async load(context: EditorContextKey, signal?: AbortSignal): Promise<ThemeEditorSnapshot> {
        const root = apiRoot(context.projectId);
        const version = context.versionId ? { versionId: context.versionId } : undefined;
        const request = { signal, params: version };
        const [project, designSystem, tokenData, components] = await Promise.all([
            http.get<ProjectDto>(`${PROJECTS_URL}/${context.projectId}`, { signal }),
            http.get<DesignSystemDto>(`${root}/design-systems/${context.designSystemId}`, request),
            this.loadTokenData(context, signal),
            this.loadComponentData(context, signal),
        ]);
        return {
            ...tokenData,
            designSystem: designSystem.data,
            componentsData: components,
            parameters: {
                projectId: context.projectId,
                projectName: project.data.name,
                packagesName: designSystem.data.name,
                tenantId: context.tenantId,
                designSystemId: context.designSystemId,
                editRevision: tokenData.tenant.editRevision,
                draftId: designSystem.data.draftId ?? undefined,
                draftRevision: designSystem.data.draftRevision ?? undefined,
                readOnly: [
                    Boolean(context.versionId),
                    project.data.status === 'archived',
                    project.data.effectiveRole === 'viewer',
                ].some(Boolean),
            },
        };
    }

    async loadTokenData(
        context: EditorContextKey,
        signal?: AbortSignal,
        knownPublicationVersion?: string,
    ): Promise<ThemeEditorTokenSnapshot> {
        const root = apiRoot(context.projectId);
        const version = context.versionId ? { versionId: context.versionId } : undefined;
        const request = { signal, params: version };
        const [tenant, tokens, values, versions] = await Promise.all([
            http.get<TenantDto>(`${root}/tenants/${context.tenantId}`, request),
            http.get<TokenDefinitionDto[]>(`${root}/design-systems/${context.designSystemId}/tokens`, request),
            http.get<TenantTokenValueDto[]>(`${root}/tenants/${context.tenantId}/token-values`, request),
            context.versionId || knownPublicationVersion
                ? Promise.resolve({ data: [] as DesignSystemVersionDto[] })
                : http.get<DesignSystemVersionDto[]>(
                      `${root}/design-system-versions/by-design-system/${context.designSystemId}`,
                      { signal },
                  ),
        ]);
        if (tenant.data.designSystemId !== context.designSystemId) throw new Error('TENANT_DESIGN_SYSTEM_MISMATCH');
        const palette = values.data.some((value) => value.paletteId)
            ? await http.get<PaletteDto[]>(`${root}/palette`, { signal })
            : { data: [] as PaletteDto[] };
        const paletteById = new Map(palette.data.map((entry) => [entry.id, entry]));
        const valuesByToken = new Map<string, TenantTokenValueDto[]>();
        for (const value of values.data)
            valuesByToken.set(value.tokenId, [...(valuesByToken.get(value.tokenId) ?? []), value]);
        const incompleteTokenIds: string[] = [];
        const metaTokens: TokenType[] = [];
        const emptyPlatforms = () => ({ web: {}, ios: {}, android: {} });
        const variations = {
            color: emptyPlatforms(),
            gradient: emptyPlatforms(),
            shape: emptyPlatforms(),
            shadow: emptyPlatforms(),
            spacing: emptyPlatforms(),
            typography: emptyPlatforms(),
            fontFamily: emptyPlatforms(),
        } as PlatformsVariations;

        for (const token of tokens.data) {
            const tokenValues = valuesByToken.get(token.id) || [];
            const usesModes = token.type === 'color' || token.type === 'gradient';
            const modes = (
                usesModes ? ['light', 'dark'] : [...new Set(tokenValues.map((value) => value.mode).filter(Boolean))]
            ) as Array<'light' | 'dark'>;
            const names = modes.length ? modes.map((mode) => `${mode}.${token.name}`) : [token.name];
            const complete = names.every((name) =>
                ['web', 'ios', 'android'].every((platform) =>
                    tokenValues.some(
                        (value) =>
                            value.platform === platform &&
                            name === (value.mode ? `${value.mode}.${token.name}` : token.name),
                    ),
                ),
            );
            if (!complete) incompleteTokenIds.push(token.id);
            for (const name of names)
                metaTokens.push({
                    type: token.type,
                    name,
                    tags: name.split('.'),
                    displayName: token.displayName ?? name,
                    description: token.description ?? undefined,
                    enabled: token.enabled,
                });
            if (usesModes) {
                // Токен, созданный в другой теме или прежними операциями, может прийти без значений этой темы:
                // пустые заглушки дают построить тему, а экран показывает токен неполным.
                const group = variations[token.type] as unknown as Record<string, Record<string, unknown>>;
                for (const name of names)
                    for (const platform of ['web', 'ios', 'android']) {
                        group[platform] ||= {};
                        group[platform][name] ??= token.type === 'gradient' ? [] : '';
                    }
            }
            for (const value of tokenValues) {
                if (!value.platform) continue;
                const name = value.mode ? `${value.mode}.${token.name}` : token.name;
                const group = variations[token.type] as unknown as Record<string, Record<string, unknown>>;
                const paletteEntry = value.paletteId ? paletteById.get(value.paletteId) : undefined;
                const preservesArrayShape = ['gradient', 'shadow'].includes(token.type);
                const storedValue = [unwrapValue(value.value), ([] as unknown[]).concat(value.value as never)][
                    Number(preservesArrayShape)
                ];
                // При ссылке через paletteId в value хранится прозрачность ссылки: ["0.56"] → [..][0.56].
                const rawOpacity = paletteEntry ? unwrapValue(value.value) : undefined;
                const opacity =
                    typeof rawOpacity === 'number' || (typeof rawOpacity === 'string' && rawOpacity.trim() !== '')
                        ? Number(rawOpacity)
                        : NaN;
                // Редактор работает со ссылками: раскрытый сервером цвет заменяется исходной ссылкой. Ссылка, которую
                // палитра темы не раскрыла, приходит прежней формой — через paletteId.
                group[value.platform][name] =
                    value.paletteRef ??
                    (paletteEntry
                        ? `[${paletteEntry.type}.${paletteEntry.shade}.${paletteEntry.saturation}]${
                              Number.isFinite(opacity) && opacity >= 0 && opacity < 1 ? `[${opacity}]` : ''
                          }`
                        : storedValue);
            }
        }
        const emptyMeta = {
            mode: [],
            category: [],
            subcategory: [],
            direction: [],
            kind: [],
            size: [],
            screen: [],
            weight: [],
        };
        const publicationVersion = knownPublicationVersion ?? nextPatchVersion(versions.data.map((version) => version.version));
        const meta = {
            name: tenant.data.name,
            version: publicationVersion,
            tokens: metaTokens,
            color: emptyMeta,
            gradient: emptyMeta,
            shape: emptyMeta,
            shadow: emptyMeta,
            spacing: emptyMeta,
            typography: emptyMeta,
            fontFamily: emptyMeta,
        } as unknown as ThemeMeta;
        return {
            tenant: tenant.data,
            themeData: { meta, variations },

            editRevision: tenant.data.editRevision,
            incompleteTokenIds,
            tokenIdsByName: Object.fromEntries(tokens.data.map((token) => [token.name, token.id])),
            tokenDefinitionsByName: Object.fromEntries(tokens.data.map((token) => [token.name, token])),
            tokenValueRevisionsByKey: Object.fromEntries(
                values.data.map((value) => [
                    tokenValueKey(value.tokenId, value.platform, value.mode),
                    value.editRevision,
                ]),
            ),
            publicationVersion,
            tokenDefinitions: tokens.data,
        };
    }

    async loadComponentData(context: EditorContextKey, signal?: AbortSignal): Promise<Meta[]> {
        const root = apiRoot(context.projectId);
        const version = context.versionId ? { versionId: context.versionId } : undefined;
        return this.loadComponents(root, context, { signal, params: version });
    }

    private async loadComponents(
        root: string,
        context: EditorContextKey,
        request: { signal?: AbortSignal; params?: { versionId: string } },
    ): Promise<Meta[]> {
        const [links, catalog, appearances, exported] = await Promise.all([
            http.get<DesignSystemComponentDto[]>(`${root}/design-system-components`, request),
            http.get<ComponentDto[]>(`${root}/components`, request),
            http.get<AppearanceDto[]>(`${root}/appearances`, request),
            Promise.all(
                (['web', 'compose', 'xml', 'ios'] as const).map((platform) =>
                    http.post<ComponentConfigExportDto>(
                        `${root}/component-config/export`,
                        { designSystemId: context.designSystemId, platform },
                        request,
                    ),
                ),
            ),
        ]);
        const linkedIds = new Set(
            links.data.filter((link) => link.designSystemId === context.designSystemId).map((link) => link.componentId),
        );
        const components = catalog.data.filter((component) => linkedIds.has(component.id));
        const entries = exported.flatMap((response) => response.data.components);
        const limitedRequest = createRequestLimiter(COMPONENT_LOAD_CONCURRENCY);
        return Promise.all(
            components.map(async (component) => {
                const [properties, variations] = await Promise.all([
                    limitedRequest(() =>
                        http.get<ComponentPropertyDto[]>(`${root}/components/${component.id}/properties`, request),
                    ),
                    limitedRequest(() =>
                        http.get<ComponentVariationDto[]>(`${root}/components/${component.id}/variations`, request),
                    ),
                ]);
                const styles = (
                    await Promise.all(
                        variations.data.map((variation) =>
                            limitedRequest(() =>
                                http.get<ComponentStyleDto[]>(`${root}/variations/${variation.id}/styles`, request),
                            ),
                        ),
                    )
                ).flatMap((response) => response.data);
                const propertyByName = new Map(properties.data.map((property) => [property.name, property]));
                const variationByName = new Map(variations.data.map((variation) => [variation.name, variation]));
                const stylesByVariation = new Map<string, ComponentStyleDto[]>();
                styles.forEach((style) =>
                    stylesByVariation.set(style.variationId, [
                        ...(stylesByVariation.get(style.variationId) ?? []),
                        style,
                    ]),
                );
                const componentAppearances = appearances.data.filter(
                    (appearance) =>
                        appearance.designSystemId === context.designSystemId && appearance.componentId === component.id,
                );
                const componentEntries = entries.filter(
                    (entry) => normalizeComponentName(entry.componentName) === normalizeComponentName(component.name),
                );
                const primaryAppearance = componentAppearances.find(
                    (candidate) => (candidate.name ?? 'default') === componentEntries[0]?.styleName,
                );
                return {
                    name: component.name,
                    description: component.description ?? '',
                    platform: component.platform,
                    serverBinding: {
                        componentId: component.id,
                        appearanceId: primaryAppearance?.id ?? componentAppearances[0]?.id ?? '',
                    },
                    sources: {
                        api: properties.data.map((property) => ({
                            id: property.id,
                            name: property.name,
                            type: property.type as Meta['sources']['api'][number]['type'],
                            description: property.description ?? undefined,
                            variations: null,
                            platformMappings: { xml: null, compose: null, ios: null, web: null },
                        })),
                        variations: variations.data,
                        configs: componentEntries.map((entry) => {
                            const appearance = componentAppearances.find(
                                (candidate) => (candidate.name ?? 'default') === entry.styleName,
                            );
                            return {
                                id: appearance?.id ?? `${component.id}:${component.platform}:${entry.styleName}`,
                                name: entry.styleName,
                                config: toLegacyComponentConfig(
                                    entry.config,
                                    propertyByName,
                                    variationByName,
                                    stylesByVariation,
                                ),
                            };
                        }),
                    },
                } as Meta;
            }),
        );
    }

    async saveTenantValues(
        context: EditorContextKey,
        editRevision: number,
        values: TenantTokenValueInputDto[],
        keepalive = false,
    ) {
        const response = await http.put<{ editRevision: number; values: TenantTokenValueDto[] }>(
            `${apiRoot(context.projectId)}/tenants/${context.tenantId}/token-values`,
            { editRevision, values },
            {
                headers: { 'X-DS-Base-Revision': '0' },
                ...(keepalive ? { adapter: 'fetch', fetchOptions: { keepalive: true } } : {}),
            },
        );
        return {
            ...response.data,
            mutationMetadata: parseMutationMetadata(response.headers?.['x-ds-mutation-metadata']),
        };
    }

    async saveTokenMutation(
        context: EditorContextKey,
        tokenId: string | undefined,
        mutation: PendingTokenMutation,
        editRevision: number,
        baseRevision: number,
        valueBaseRevisions: Record<string, number>,
        idempotencyKey: string,
        keepalive = false,
    ) {
        const root = apiRoot(context.projectId);
        const mode: 'light' | 'dark' | null = mutation.tokenName.startsWith('light.')
            ? 'light'
            : mutation.tokenName.startsWith('dark.')
              ? 'dark'
              : null;
        const tokenName = mode ? mutation.tokenName.slice(mode.length + 1) : mutation.tokenName;
        let stableTokenId = tokenId;
        const headers = { 'X-DS-Base-Revision': String(baseRevision) };
        if (mutation.kind === 'delete') {
            if (!stableTokenId) throw new Error('TOKEN_ID_REQUIRED_FOR_DELETE');
            const deleted = await http.delete(`${root}/tokens/${stableTokenId}`, {
                headers,
                ...(keepalive ? { adapter: 'fetch', fetchOptions: { keepalive: true } } : {}),
            });
            const metadata = parseMutationMetadata(deleted.headers?.['x-ds-mutation-metadata']);
            const revision = metadata.reduce((latest, item) => Math.max(latest, item.revision), baseRevision);
            return {
                tokenId: stableTokenId,
                editRevision,
                baseRevision: revision,
                valueBaseRevisions,
            };
        }
        let tokenMutationMetadata: Array<{ entityType: string; entityId: string; revision: number }> = [];
        if (!stableTokenId) {
            const created = await http.post<TokenDefinitionDto>(
                `${root}/tokens`,
                {
                    designSystemId: context.designSystemId,
                    name: tokenName,
                    type: mutation.change.type,
                    displayName: mutation.change.meta?.displayName ?? tokenName,
                    description: mutation.change.description ?? null,
                    enabled: mutation.change.enabled,
                },
                {
                    headers: { ...headers, 'Idempotency-Key': idempotencyKey },
                    ...(keepalive ? { adapter: 'fetch', fetchOptions: { keepalive: true } } : {}),
                },
            );
            stableTokenId = created.data.id;
            tokenMutationMetadata = parseMutationMetadata(created.headers?.['x-ds-mutation-metadata']);
        } else if (mutation.definitionPatch && Object.keys(mutation.definitionPatch).length > 0) {
            const updated = await http.patch(
                `${root}/tokens/${stableTokenId}`,
                mutation.definitionPatch,
                {
                    headers,
                    ...(keepalive ? { adapter: 'fetch', fetchOptions: { keepalive: true } } : {}),
                },
            );
            tokenMutationMetadata = parseMutationMetadata(updated.headers?.['x-ds-mutation-metadata']);
        }
        const values = (['web', 'ios', 'android'] as const)
            .filter((platform) => mutation.change.values[platform] !== undefined)
            .map((platform) => ({
                tokenId: stableTokenId!,
                platform,
                mode,
                value: mutation.change.values[platform],
                baseRevision: valueBaseRevisions[tokenValueKey(stableTokenId!, platform, mode)] ?? 0,
            }));
        const saved = values.length
            ? await this.saveTenantValues(context, editRevision, values, keepalive)
            : { editRevision, values: [] as TenantTokenValueDto[], mutationMetadata: [] };
        const tokenRevision = tokenMutationMetadata.reduce(
            (latest, item) => Math.max(latest, item.revision),
            baseRevision,
        );
        return {
            tokenId: stableTokenId,
            editRevision: saved.editRevision,
            baseRevision: tokenRevision,
            valueBaseRevisions: Object.fromEntries(
                saved.values.map((value) => [
                    tokenValueKey(value.tokenId, value.platform, value.mode),
                    value.editRevision,
                ]),
            ),
        };
    }

    async saveComponentMutation(
        context: EditorContextKey,
        meta: Meta,
        mutation: PendingComponentMutation,
        baseRevisions: Record<string, number>,
        onPendingUpdate?: (revisions: Record<string, number>) => void,
    ): Promise<Record<string, number>> {
        const binding = meta.serverBinding;
        if ([binding?.componentId, binding?.appearanceId].some((value) => !value))
            throw new Error('COMPONENT_SERVER_BINDING_REQUIRED');
        const stableBinding = binding as { componentId: string; appearanceId: string };
        const root = apiRoot(context.projectId);
        const request = { params: context.versionId ? { versionId: context.versionId } : undefined };
        const [axes, axisValues, invariantValues, variationValues, states, stateSets, tokens] = await Promise.all([
            http.get<AppearanceVariationDto[]>(`${root}/appearance-variations`, request),
            http.get<AppearanceVariationValueDto[]>(`${root}/appearance-variation-values`, request),
            http.get<PropertyValueDto[]>(
                `${root}/invariant-property-values/by-component/${stableBinding.componentId}/by-design-system/${context.designSystemId}`,
                request,
            ),
            http.get<PropertyValueDto[]>(
                `${root}/variation-property-values/by-appearance/${stableBinding.appearanceId}`,
                request,
            ),
            http.get<ComponentStateDto[]>(`${root}/states`, request),
            http.get<ComponentStateSetDto[]>(`${root}/state-sets`, request),
            http.get<TokenDefinitionDto[]>(`${root}/design-systems/${context.designSystemId}/tokens`, request),
        ]);
        const revisions = { ...baseRevisions };
        const axisByVariation = new Map(
            axes.data
                .filter((axis) => axis.appearanceId === stableBinding.appearanceId)
                .map((axis) => [axis.variationId, axis]),
        );
        const axisValueByStyle = new Map(axisValues.data.map((value) => [value.styleId, value]));
        const stateNameById = new Map(states.data.map((state) => [state.id, state.name]));
        const stateIdByName = new Map(states.data.map((state) => [state.name, state.id]));
        const stateNamesBySet = new Map(
            stateSets.data.map((set) => [
                set.id,
                set.stateIds
                    .map((id) => stateNameById.get(id))
                    .filter(Boolean)
                    .sort()
                    .join('+'),
            ]),
        );
        const tokenIdByName = new Map(tokens.data.map((token) => [token.name, token.id]));
        const propertyValues = [...invariantValues.data, ...variationValues.data];
        const propertyKey = (change: Extract<ComponentChange, { kind: 'property' }>) =>
            [change.styleId ?? 'invariant', change.propertyId, [...change.stateNames].sort().join('+')].join(':');
        const valueByKey = new Map(
            propertyValues.map((value) => [
                [value.styleId ?? 'invariant', value.propertyId, stateNamesBySet.get(value.stateSetId) ?? ''].join(':'),
                value,
            ]),
        );
        const entityHeaders = (entityType: string, entityId: string, idempotencyKey?: string) => ({
            'X-DS-Base-Revision': String(revisions[`${entityType}:${entityId}`] ?? 0),
            ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        });
        const acceptMetadata = (headers: unknown) => {
            const raw = (headers as Record<string, unknown> | undefined)?.['x-ds-mutation-metadata'];
            parseMutationMetadata(raw).forEach((item) => {
                revisions[`${item.entityType}:${item.entityId}`] = item.revision;
            });
            onPendingUpdate?.({ ...revisions });
        };
        const idempotency = (key: string) =>
            mutation.idempotencyKeys[key] ??
            (() => {
                const value = crypto.randomUUID();
                mutation.idempotencyKeys[key] = value;
                onPendingUpdate?.({ ...revisions });
                return value;
            })();
        const styleIds = new Map<string, string>();
        const changes = componentChanges(mutation.before, mutation.after);

        await applySequentially(
            changes.filter(
                (item): item is Extract<ComponentChange, { kind: 'property' }> & { action: 'delete' } =>
                    item.kind === 'property' && item.action === 'delete',
            ),
            async (change) => {
                const existing = valueByKey.get(propertyKey(change));
                if (!existing) return;
                const entityType = change.styleId ? 'variation-property-value' : 'invariant-property-value';
                const response = await http.delete(
                    `${root}/${change.styleId ? 'variation' : 'invariant'}-property-values/${existing.id}`,
                    { headers: entityHeaders(entityType, existing.id) },
                );
                acceptMetadata(response.headers);
            },
        );

        await applySequentially(
            changes.filter(
                (item): item is Extract<ComponentChange, { kind: 'style' }> & { action: 'create' } =>
                    item.kind === 'style' && item.action === 'create',
            ),
            async (change) => {
                const created = await http.post<ComponentStyleDto>(
                    `${root}/styles`,
                    {
                        designSystemId: context.designSystemId,
                        variationId: change.variationId,
                        name: change.name,
                    },
                    { headers: entityHeaders('style', change.styleId, idempotency(`style:${change.styleId}`)) },
                );
                acceptMetadata(created.headers);
                styleIds.set(change.styleId, created.data.id);
                const axis = axisByVariation.get(change.variationId);
                if (!axis) throw new Error('APPEARANCE_VARIATION_NOT_FOUND');
                const linked = await http.post<AppearanceVariationValueDto>(
                    `${root}/appearance-variation-values`,
                    {
                        appearanceVariationId: axis.id,
                        styleId: created.data.id,
                        position: axisValues.data.filter((value) => value.appearanceVariationId === axis.id).length,
                    },
                    {
                        headers: entityHeaders(
                            'appearance-variation-value',
                            change.styleId,
                            idempotency(`axis-value:${change.styleId}`),
                        ),
                    },
                );
                acceptMetadata(linked.headers);
                axisValueByStyle.set(created.data.id, linked.data);
            },
        );

        await applySequentially(
            changes.filter((item): item is Extract<ComponentChange, { kind: 'default' }> => item.kind === 'default'),
            async (change) => {
                const axis = axisByVariation.get(change.variationId);
                if (!axis) throw new Error('APPEARANCE_VARIATION_NOT_FOUND');
                const response = await http.patch(
                    `${root}/appearance-variations/${axis.id}`,
                    { defaultStyleId: change.styleId ? (styleIds.get(change.styleId) ?? change.styleId) : null },
                    { headers: entityHeaders('appearance-variation', axis.id) },
                );
                acceptMetadata(response.headers);
            },
        );

        const resolveStateSet = async (stateNames: string[]) => {
            const key = [...stateNames].sort().join('+');
            const existing = [...stateNamesBySet.entries()].find(([, names]) => names === key)?.[0];
            if (existing) return existing;
            const stateIds = stateNames.map((name) => stateIdByName.get(name));
            if (stateIds.some((id) => !id)) throw new Error('COMPONENT_STATE_NOT_FOUND');
            return (
                await http.post<{ id: string }>(
                    `${root}/state-sets/resolve`,
                    { stateIds },
                    { headers: { 'Idempotency-Key': idempotency(`state-set:${key}`) } },
                )
            ).data.id;
        };
        await applySequentially(
            changes.filter(
                (item): item is Extract<ComponentChange, { kind: 'property' }> & { action: 'upsert' } =>
                    item.kind === 'property' && item.action === 'upsert',
            ),
            async (change) => {
                const actualStyleId = change.styleId ? (styleIds.get(change.styleId) ?? change.styleId) : undefined;
                const actual = { ...change, styleId: actualStyleId };
                const existing = valueByKey.get(propertyKey(actual));
                const rawValue = change.value == null ? null : String(change.value).replace(/^\[|\]$/g, '');
                const tokenName = rawValue?.replace(/^(light|dark)\./, '') ?? '';
                const tokenId = tokenIdByName.get(tokenName) ?? null;
                const body = {
                    tokenId,
                    value: tokenId ? null : rawValue,
                    adjustment: change.adjustment == null ? null : String(change.adjustment),
                };
                const entityType = actualStyleId ? 'variation-property-value' : 'invariant-property-value';
                if (existing) {
                    const response = await http.patch(
                        `${root}/${actualStyleId ? 'variation' : 'invariant'}-property-values/${existing.id}`,
                        body,
                        { headers: entityHeaders(entityType, existing.id) },
                    );
                    acceptMetadata(response.headers);
                    return;
                }
                const stateSetId = await resolveStateSet(change.stateNames);
                const createBody = actualStyleId
                    ? {
                          ...body,
                          propertyId: change.propertyId,
                          styleId: actualStyleId,
                          appearanceId: stableBinding.appearanceId,
                          stateSetId,
                      }
                    : {
                          ...body,
                          propertyId: change.propertyId,
                          designSystemId: context.designSystemId,
                          componentId: stableBinding.componentId,
                          appearanceId: stableBinding.appearanceId,
                          stateSetId,
                      };
                const operationKey = `property:${propertyKey(actual)}`;
                const response = await http.post<PropertyValueDto>(
                    `${root}/${actualStyleId ? 'variation' : 'invariant'}-property-values`,
                    createBody,
                    { headers: entityHeaders(entityType, operationKey, idempotency(operationKey)) },
                );
                acceptMetadata(response.headers);
            },
        );

        await applySequentially(
            changes.filter(
                (item): item is Extract<ComponentChange, { kind: 'style' }> & { action: 'delete' } =>
                    item.kind === 'style' && item.action === 'delete',
            ),
            async (change) => {
                const axisValue = axisValueByStyle.get(change.styleId);
                if (axisValue) {
                    const unlinked = await http.delete(`${root}/appearance-variation-values/${axisValue.id}`, {
                        headers: entityHeaders('appearance-variation-value', axisValue.id),
                    });
                    acceptMetadata(unlinked.headers);
                }
                const deleted = await http.delete(`${root}/styles/${change.styleId}`, {
                    headers: entityHeaders('style', change.styleId),
                });
                acceptMetadata(deleted.headers);
            },
        );
        return revisions;
    }

    async listVersions(context: EditorContextKey, signal?: AbortSignal) {
        return (
            await http.get<DesignSystemVersionDto[]>(
                `${apiRoot(context.projectId)}/design-system-versions/by-design-system/${context.designSystemId}`,
                { signal },
            )
        ).data;
    }

    async getDesignSystem(context: EditorContextKey, signal?: AbortSignal) {
        return (
            await http.get<DesignSystemDto>(`${apiRoot(context.projectId)}/design-systems/${context.designSystemId}`, {
                signal,
            })
        ).data;
    }

    async listChanges(context: EditorContextKey, signal?: AbortSignal) {
        return (
            await http.get<DraftChangeDto[]>(
                `${apiRoot(context.projectId)}/design-systems/${context.designSystemId}/changes`,
                { signal, params: context.versionId ? { versionId: context.versionId } : undefined },
            )
        ).data;
    }

    async listJournalTokens(context: EditorContextKey, signal?: AbortSignal) {
        return (
            await http.get<TokenDefinitionDto[]>(
                `${apiRoot(context.projectId)}/design-systems/${context.designSystemId}/tokens`,
                { signal, params: context.versionId ? { versionId: context.versionId } : undefined },
            )
        ).data;
    }

    async listProjectActorLabels(projectId: string, signal?: AbortSignal) {
        const [projectResult, membersResult] = await Promise.allSettled([
            http.get<ProjectDto>(`${PROJECTS_URL}/${projectId}`, { signal }),
            http.get<ProjectMemberDto[]>(`${PROJECTS_URL}/${projectId}/members`, { signal }),
        ]);
        const labels: Record<string, string> = {};
        if (projectResult.status === 'fulfilled') {
            const project = projectResult.value.data;
            labels[project.ownerUserId] =
                project.ownerDisplayName || project.ownerUsername || project.ownerEmail || project.ownerUserId;
        }
        if (membersResult.status === 'fulfilled') {
            membersResult.value.data.forEach((member) => {
                labels[member.userId] = member.displayName || member.username || member.email || member.userId;
            });
        }
        return labels;
    }

    async revertChange(context: EditorContextKey, change: DraftChangeDto) {
        return http.post(
            `${apiRoot(context.projectId)}/design-systems/${context.designSystemId}/changes/${change.changeId}/revert`,
            {},
            {
                headers: {
                    'X-DS-Base-Revision': String(change.editRevision),
                    'Idempotency-Key': crypto.randomUUID(),
                },
            },
        );
    }

    async publish(
        context: EditorContextKey,
        draftId: string,
        draftRevision: number,
        version: string,
        changelog: string,
        idempotencyKey: string,
    ) {
        return (
            await http.post<DesignSystemVersionDto>(
                `${apiRoot(context.projectId)}/design-system-versions`,
                { designSystemId: context.designSystemId, draftId, draftRevision, version, changelog },
                { headers: { 'Idempotency-Key': idempotencyKey } },
            )
        ).data;
    }
}

const createRequestLimiter = (maximum: number) => {
    let active = 0;
    const waiting: Array<() => void> = [];
    return async <T,>(request: () => Promise<T>): Promise<T> => {
        if (active >= maximum) await new Promise<void>((resolve) => waiting.push(resolve));
        active += 1;
        try {
            return await request();
        } finally {
            active -= 1;
            waiting.shift()?.();
        }
    };
};

const COMPONENT_LOAD_CONCURRENCY = 4;

const parseMutationMetadata = (raw: unknown): Array<{ entityType: string; entityId: string; revision: number }> => {
    if (typeof raw !== 'string') return [];
    try {
        return JSON.parse(raw);
    } catch {
        return [];
    }
};

const nextPatchVersion = (versions: string[]): string => {
    const ordered = versions
        .map((version) => version.split('.').map(Number))
        .filter((parts) => parts.length === 3 && parts.every(Number.isInteger))
        .sort((left, right) => left[0] - right[0] || left[1] - right[1] || left[2] - right[2]);
    const latest = ordered[ordered.length - 1];
    return latest ? `${latest[0]}.${latest[1]}.${latest[2] + 1}` : '0.1.0';
};
