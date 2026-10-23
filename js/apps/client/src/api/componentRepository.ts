import { http } from './http';
import { readEditor, invalidateEditorReads } from './editorReads';
import type { Meta } from '../controllers/componentBuilder/type';
import { componentChanges, type ComponentChange } from './componentAutosave';
import type {
    EditorContextKey,
    TokenDefinitionDto,
    ComponentDto,
    DesignSystemComponentDto,
    AppearanceDto,
    ComponentPropertyDto,
    ComponentVariationDto,
    ComponentStyleDto,
    AppearanceVariationDto,
    AppearanceVariationValueDto,
    ComponentStateDto,
    ComponentStateSetDto,
    PropertyValueDto,
    ComponentConfigPropertyDto,
    ComponentConfigDto,
    ComponentConfigExportDto,
    PendingComponentMutation,
} from './editorContracts';
import { apiRoot, parseMutationMetadata, readRequest } from './editorHttp';
import { isComponentEditorEnabled } from '../utils/featureFlags';
import { hasConfiguration, markComposeComponents, resolveComposePreviewPluginUrl } from '../composePreview';
import { fetchComposePreviewPluginDescriptor } from './composePreviewPluginRepository';
import { camelToKebab } from '../utils/text';
import {
    collectDependencies,
    enrichApi,
    templateLookup,
    variationNamesByProperty,
    composeParamsByProperty,
    webParamsByProperty,
    type ComponentDependencyDto,
    type PropertyPlatformParamDto,
    type PropertyVariationDto,
    type WebAdapterComponentDto,
} from './componentModelEnrichment';

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

const createRequestLimiter = (maximum: number) => {
    let active = 0;
    const waiting: Array<() => void> = [];
    return async <T>(request: () => Promise<T>): Promise<T> => {
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

/** Предметный клиент с ограниченным набором операций. */
export const componentRepository = {
    /** Краткая навигация без конфигураций и без чтений свойств/осей/стилей. */
    async loadComponentIndex(context: EditorContextKey, signal?: AbortSignal): Promise<Meta[]> {
        if (!isComponentEditorEnabled()) return [];
        const root = apiRoot(context.projectId);
        const request = readRequest(context, signal);
        const [catalog, appearances] = await Promise.all([
            readEditor<ComponentDto[]>(`${root}/components`, request),
            readEditor<AppearanceDto[]>(`${root}/design-systems/${context.designSystemId}/appearances`, request),
        ]);
        const configured = new Set(appearances.data.map((appearance) => appearance.componentId));
        // Без активного билда (и без прямого адреса) Compose-компоненты в навигации не показываются; адрес плагина
        // запрашивается только когда в каталоге есть настроенные Compose-компоненты.
        const hasCompose = catalog.data.some(
            (component) => component.platform === 'compose' && configured.has(component.id),
        );
        const pluginUrl = hasCompose
            ? await resolveComposePreviewPluginUrl(context.projectId, fetchComposePreviewPluginDescriptor).catch(
                  () => undefined,
              )
            : undefined;
        return catalog.data
            .filter(
                (component) =>
                    configured.has(component.id) &&
                    (component.platform === 'web' || (component.platform === 'compose' && Boolean(pluginUrl))),
            )
            .map(
                (component) =>
                    ({
                        name: component.name,
                        description: component.description ?? '',
                        platform: component.platform,
                        serverBinding: {
                            componentId: component.id,
                            appearanceId:
                                appearances.data.find((appearance) => appearance.componentId === component.id)?.id ??
                                '',
                            appearanceNames: appearances.data
                                .filter((appearance) => appearance.componentId === component.id)
                                .map((appearance) => appearance.name ?? 'default'),
                        },
                        sources: { api: [], variations: [], configs: [] },
                    }) as Meta,
            );
    },

    async loadComponentData(
        context: EditorContextKey,
        signal?: AbortSignal,
        platform: ComponentDto['platform'] = 'web',
        componentName?: string,
    ): Promise<Meta[]> {
        // Модель web-компонентов нужна не только разделу «Компоненты»: «Цвета» берут из неё связи токенов,
        // пары контраста и канвас. Флаг прячет раздел, а не данные, поэтому здесь не проверяется.
        const root = apiRoot(context.projectId);
        const request = readRequest(context, signal);
        // Web-параметры, панели вариаций и шаблоны нужны только web-превью; Compose-превью нужны только имена
        // Compose-параметров свойств: без них сборка payload отвечает `missing_mapping`.
        const isWeb = platform === 'web';
        const isCompose = platform === 'compose';
        const empty = <T>() => Promise.resolve({ data: [] as T[] });
        const [links, catalog, appearances, exported, params, propertyVariations, adapter, dependencies] =
            await Promise.all([
                readEditor<DesignSystemComponentDto[]>(`${root}/design-system-components`, request),
                readEditor<ComponentDto[]>(`${root}/components`, request),
                readEditor<AppearanceDto[]>(`${root}/appearances`, request),
                Promise.all(
                    [platform].map((platform) =>
                        readEditor<ComponentConfigExportDto>(`${root}/component-config/export`, request, {
                            designSystemId: context.designSystemId,
                            platform,
                            ...(componentName ? { components: [camelToKebab(componentName)] } : {}),
                        }),
                    ),
                ),
                isWeb || isCompose
                    ? readEditor<PropertyPlatformParamDto[]>(`${root}/property-platform-params`, request)
                    : empty<PropertyPlatformParamDto>(),
                isWeb
                    ? readEditor<PropertyVariationDto[]>(`${root}/property-variations`, request)
                    : empty<PropertyVariationDto>(),
                isWeb
                    ? readEditor<WebAdapterComponentDto[]>(`${root}/component-config/web-adapter`, request, {
                          designSystemId: context.designSystemId,
                      })
                    : empty<WebAdapterComponentDto>(),
                readEditor<ComponentDependencyDto[]>(`${root}/component-deps`, request),
            ]);
        const webParams = webParamsByProperty(params.data);
        const composeParams = composeParamsByProperty(params.data);
        const adapterByName = new Map(adapter.data.map((entry) => [entry.name, entry]));
        const linkedIds = new Set(
            links.data.filter((link) => link.designSystemId === context.designSystemId).map((link) => link.componentId),
        );
        const entries = exported.flatMap((response) => response.data.components);
        const configuredNames = new Set(entries.map((entry) => normalizeComponentName(entry.componentName)));
        const components = catalog.data.filter(
            (component) =>
                linkedIds.has(component.id) &&
                component.platform === platform &&
                (!componentName || normalizeComponentName(component.name) === normalizeComponentName(componentName)) &&
                configuredNames.has(normalizeComponentName(component.name)),
        );
        const depsByParent = collectDependencies(
            dependencies.data,
            new Map(
                catalog.data
                    .filter((component) => linkedIds.has(component.id) && component.platform === platform)
                    .map((component) => [component.id, component.name]),
            ),
        );
        const limitedRequest = createRequestLimiter(COMPONENT_LOAD_CONCURRENCY);
        return Promise.all(
            components.map(async (component) => {
                const [properties, variations] = await Promise.all([
                    limitedRequest(() =>
                        readEditor<ComponentPropertyDto[]>(`${root}/components/${component.id}/properties`, request),
                    ),
                    limitedRequest(() =>
                        readEditor<ComponentVariationDto[]>(`${root}/components/${component.id}/variations`, request),
                    ),
                ]);
                const styles = componentName
                    ? (
                          await readEditor<ComponentStyleDto[]>(
                              `${root}/design-systems/${context.designSystemId}/components/${component.id}/styles`,
                              request,
                          )
                      ).data
                    : (
                          await Promise.all(
                              variations.data.map((variation) =>
                                  limitedRequest(() =>
                                      readEditor<ComponentStyleDto[]>(
                                          `${root}/variations/${variation.id}/styles`,
                                          request,
                                      ),
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
                    deps: depsByParent.get(component.name) ?? [],
                    serverBinding: {
                        componentId: component.id,
                        appearanceId: primaryAppearance?.id ?? componentAppearances[0]?.id ?? '',
                    },
                    sources: {
                        api: enrichApi(
                            properties.data.map((property) => ({
                                id: property.id,
                                name: property.name,
                                type: property.type as Meta['sources']['api'][number]['type'],
                                description: property.description ?? undefined,
                                variations: null,
                                platformMappings: {
                                    xml: null,
                                    compose: composeParams.get(property.id)?.join(',') ?? null,
                                    ios: null,
                                    web: null,
                                },
                            })),
                            webParams,
                            variationNamesByProperty(
                                propertyVariations.data,
                                new Map(variations.data.map((variation) => [variation.id, variation.name])),
                            ),
                            templateLookup(
                                adapterByName.get(component.name),
                                componentEntries.map((entry) => entry.styleName),
                            ),
                        ),
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
    },

    async loadComposeComponentData(context: EditorContextKey, signal?: AbortSignal): Promise<Meta[]> {
        if (!isComponentEditorEnabled()) return [];
        try {
            // Без активного билда (и без прямого адреса) Compose-preview не предлагается: React-preview не меняется.
            const pluginUrl = await resolveComposePreviewPluginUrl(
                context.projectId,
                fetchComposePreviewPluginDescriptor,
            );
            if (!pluginUrl) return [];

            return markComposeComponents(
                (await this.loadComponentData(context, signal, 'compose')).filter(hasConfiguration),
            );
        } catch (error) {
            if (signal?.aborted) throw error;
            console.error('[ComponentRepository] Не удалось загрузить Compose-компоненты', error);
            return [];
        }
    },

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
            readEditor<AppearanceVariationDto[]>(`${root}/appearance-variations`, request),
            readEditor<AppearanceVariationValueDto[]>(`${root}/appearance-variation-values`, request),
            readEditor<PropertyValueDto[]>(
                `${root}/invariant-property-values/by-component/${stableBinding.componentId}/by-design-system/${context.designSystemId}`,
                request,
            ),
            readEditor<PropertyValueDto[]>(
                `${root}/variation-property-values/by-appearance/${stableBinding.appearanceId}`,
                request,
            ),
            readEditor<ComponentStateDto[]>(`${root}/states`, request),
            readEditor<ComponentStateSetDto[]>(`${root}/state-sets`, request),
            readEditor<TokenDefinitionDto[]>(`${root}/design-systems/${context.designSystemId}/tokens`, request),
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
            invalidateEditorReads();
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
        const aliases = (mutation.styleAliases ??= {});
        Object.entries(mutation.requestBodies ?? {}).forEach(([key, body]) => {
            if (key.startsWith('axis-value:')) aliases[key.slice('axis-value:'.length)] ??= body.styleId;
        });
        const createdStyleIds = new Map<string, string>();
        const actualStyleId = (id: string) => createdStyleIds.get(id) ?? aliases[id] ?? id;
        const normalizeStyleIds = (config: PendingComponentMutation['before']) => ({
            ...config,
            defaultVariations: config.defaultVariations.map((item) => ({
                ...item,
                styleID: actualStyleId(item.styleID),
            })),
            variations: config.variations.map((variation) => ({
                ...variation,
                styles: variation.styles?.map((style) => ({ ...style, id: actualStyleId(style.id) })),
            })),
        });
        // Идентичность сравнивается по серверному ID, но ключи подготовленного создания остаются локальными.
        const originalStyleIds = new Map(
            mutation.after.variations.flatMap(
                (variation) => variation.styles?.map((style) => [actualStyleId(style.id), style.id] as const) ?? [],
            ),
        );
        const changes = componentChanges(normalizeStyleIds(mutation.before), normalizeStyleIds(mutation.after));

        await applySequentially(
            changes.filter(
                (item): item is Extract<ComponentChange, { kind: 'property' }> & { action: 'delete' } =>
                    item.kind === 'property' && item.action === 'delete',
            ),
            async (change) => {
                const existing = valueByKey.get(
                    propertyKey({
                        ...change,
                        styleId: change.styleId ? actualStyleId(change.styleId) : undefined,
                    }),
                );
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
                const originalStyleId = originalStyleIds.get(change.styleId) ?? change.styleId;
                const created = await http.post<ComponentStyleDto>(
                    `${root}/styles`,
                    {
                        designSystemId: context.designSystemId,
                        variationId: change.variationId,
                        name: change.name,
                    },
                    { headers: entityHeaders('style', originalStyleId, idempotency(`style:${originalStyleId}`)) },
                );
                aliases[originalStyleId] = created.data.id;
                createdStyleIds.set(change.styleId, created.data.id);
                acceptMetadata(created.headers);
                const axis = axisByVariation.get(change.variationId);
                if (!axis) throw new Error('APPEARANCE_VARIATION_NOT_FOUND');
                const operationKey = `axis-value:${originalStyleId}`;
                const bodies = (mutation.requestBodies ??= {});
                if (!bodies[operationKey]) {
                    bodies[operationKey] = {
                        appearanceVariationId: axis.id,
                        styleId: created.data.id,
                        position: axisValues.data.filter((value) => value.appearanceVariationId === axis.id).length,
                    };
                    onPendingUpdate?.({ ...revisions });
                }
                const linked = await http.post<AppearanceVariationValueDto>(
                    `${root}/appearance-variation-values`,
                    bodies[operationKey],
                    {
                        headers: entityHeaders('appearance-variation-value', change.styleId, idempotency(operationKey)),
                    },
                );
                acceptMetadata(linked.headers);
                axisValueByStyle.set(created.data.id, linked.data);
                if (!axisValues.data.some(({ id }) => id === linked.data.id)) axisValues.data.push(linked.data);
            },
        );

        await applySequentially(
            changes.filter((item): item is Extract<ComponentChange, { kind: 'default' }> => item.kind === 'default'),
            async (change) => {
                const axis = axisByVariation.get(change.variationId);
                if (!axis) throw new Error('APPEARANCE_VARIATION_NOT_FOUND');
                const response = await http.patch(
                    `${root}/appearance-variations/${axis.id}`,
                    { defaultStyleId: change.styleId ? actualStyleId(change.styleId) : null },
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
                const resolvedStyleId = change.styleId ? actualStyleId(change.styleId) : undefined;
                const actual = { ...change, styleId: resolvedStyleId };
                const existing = valueByKey.get(propertyKey(actual));
                const rawValue = change.value == null ? null : String(change.value).replace(/^\[|\]$/g, '');
                const tokenName = rawValue?.replace(/^(light|dark)\./, '') ?? '';
                const tokenId = tokenIdByName.get(tokenName) ?? null;
                const body = {
                    tokenId,
                    value: tokenId ? null : rawValue,
                    adjustment: change.adjustment == null ? null : String(change.adjustment),
                };
                const entityType = resolvedStyleId ? 'variation-property-value' : 'invariant-property-value';
                if (existing) {
                    const response = await http.patch(
                        `${root}/${resolvedStyleId ? 'variation' : 'invariant'}-property-values/${existing.id}`,
                        body,
                        { headers: entityHeaders(entityType, existing.id) },
                    );
                    acceptMetadata(response.headers);
                    return;
                }
                const stateSetId = await resolveStateSet(change.stateNames);
                const createBody = resolvedStyleId
                    ? {
                          ...body,
                          propertyId: change.propertyId,
                          styleId: resolvedStyleId,
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
                    `${root}/${resolvedStyleId ? 'variation' : 'invariant'}-property-values`,
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
                const serverStyleId = actualStyleId(change.styleId);
                const axisValue = axisValueByStyle.get(serverStyleId);
                if (axisValue) {
                    const unlinked = await http.delete(`${root}/appearance-variation-values/${axisValue.id}`, {
                        headers: entityHeaders('appearance-variation-value', axisValue.id),
                    });
                    acceptMetadata(unlinked.headers);
                }
                const deleted = await http.delete(`${root}/styles/${serverStyleId}`, {
                    headers: entityHeaders('style', serverStyleId),
                });
                acceptMetadata(deleted.headers);
            },
        );
        return revisions;
    },
};
