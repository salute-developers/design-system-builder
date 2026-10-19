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
export class ComponentRepository {
    async loadComponentData(context: EditorContextKey, signal?: AbortSignal): Promise<Meta[]> {
        const root = apiRoot(context.projectId);
        const request = readRequest(context, signal);
        const [links, catalog, appearances, exported] = await Promise.all([
            readEditor<DesignSystemComponentDto[]>(`${root}/design-system-components`, request),
            readEditor<ComponentDto[]>(`${root}/components`, request),
            readEditor<AppearanceDto[]>(`${root}/appearances`, request),
            Promise.all(
                (['web', 'compose', 'xml', 'ios'] as const).map((platform) =>
                    readEditor<ComponentConfigExportDto>(`${root}/component-config/export`, request, {
                        designSystemId: context.designSystemId,
                        platform,
                    }),
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
                        readEditor<ComponentPropertyDto[]>(`${root}/components/${component.id}/properties`, request),
                    ),
                    limitedRequest(() =>
                        readEditor<ComponentVariationDto[]>(`${root}/components/${component.id}/variations`, request),
                    ),
                ]);
                const styles = (
                    await Promise.all(
                        variations.data.map((variation) =>
                            limitedRequest(() =>
                                readEditor<ComponentStyleDto[]>(`${root}/variations/${variation.id}/styles`, request),
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
}

export const componentRepository = new ComponentRepository();
