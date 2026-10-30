import { defaultGroupForToken } from '../../modules/palette/domain/groups';
import type { ConfirmedTokenValues, ConfirmedColorStructure } from '../../api/draftAutosaveActivity';
import { storedTokenValue } from '../../api/confirmedTokenValues';
import { tokenValueKey } from '../../api/editorHttp';
import { tokenValueBaseRevision } from '../../api/subjectRevisions';
import type { EditorContextKey, ThemeEditorSnapshot, TokenDefinitionDto } from '../../api/editorContracts';
import { componentRepository } from '../../api/componentRepository';
import { tokenRepository } from '../../api/tokenRepository';
import { loadThemeShell } from '../../api/themeEditorRepository';
import type { DraftInvalidationScope } from '../../api/draftInvalidationStream';
import { markComposeComponents, parseComponentRoute } from '../../composePreview/composeComponents';
import { paletteRepository } from '../../palette/paletteSession';
import { sectionTokenTypes, type EditorSection } from './editorSections';
import { mergeSectionTokens } from './mergeSectionSnapshot';
import { componentSectionReferences } from './componentSectionReferences';
import { getEditorMetadataRevision } from '../../api/editorReads';
import { getDraftAutosaveRevision, getDraftAutosaveSourceStatus } from '../../api/draftAutosaveActivity';

export interface SectionReadResult {
    snapshot: ThemeEditorSnapshot;
    tokensChanged: boolean;
    componentsChanged: boolean;
    tokenTypes: TokenDefinitionDto['type'][];
    activityRevision: number;
}

/** Явное состояние целых разделов и компонентов одной сессии; не граф произвольных ресурсов. */
export class EditorSectionData {
    private readonly context: EditorContextKey;
    private snapshot: ThemeEditorSnapshot;
    private readonly signal: AbortSignal;
    private active: { section: EditorSection; component?: string } = { section: 'colors' };
    private generation = 0;
    private readonly invalidated = new Map<string, number>();
    private readonly loaded = new Map<string, number>();
    private readonly componentReadAt = new Map<string, number>();
    private readonly componentTypes = new Map<string, TokenDefinitionDto['type'][]>();
    private chain: Promise<unknown> = Promise.resolve();
    private shellStale = false;
    private confirmedStructurePending = false;
    private readonly componentMetadataRevision = new Map<string, number>();

    constructor(context: EditorContextKey, snapshot: ThemeEditorSnapshot, signal: AbortSignal) {
        this.context = context;
        this.snapshot = snapshot;
        this.signal = signal;
    }

    get activeSection() {
        return this.active.section;
    }
    get activeComponent() {
        return this.active.component;
    }
    get currentSnapshot() {
        return this.snapshot;
    }

    acceptDraftCursor(draftId: string, draftRevision?: number) {
        if (this.context.versionId || draftId !== this.snapshot.designSystem.draftId || draftRevision == null) return;
        const revision = Math.max(this.snapshot.designSystem.draftRevision ?? 0, draftRevision);
        this.snapshot = {
            ...this.snapshot,
            designSystem: { ...this.snapshot.designSystem, draftRevision: revision },
            parameters: { ...this.snapshot.parameters, draftRevision: revision },
        };
    }

    /** Неструктурный ACK обновляет уже загруженные значения, сохраняя инвалидацию удалённых изменений. */
    acceptConfirmedValues(updates: ConfirmedTokenValues[]): boolean {
        if (!updates.length) return false;
        const definitions = Object.values(this.snapshot.tokenDefinitionsByName ?? {});
        const entries = updates.map((update) => ({
            update,
            token: definitions.find((token) => token.id === update.tokenId),
        }));
        if (
            entries.some(
                ({ update, token }) =>
                    !token ||
                    this.snapshot.incompleteTokenIds.includes(update.tokenId) ||
                    update.values.some(
                        (value) =>
                            value.revision !== undefined &&
                            value.revision <
                                (this.snapshot.tokenValueRevisionsByKey[
                                    tokenValueKey(update.tokenId, value.platform, value.mode ?? null)
                                ] ?? 0),
                    ) ||
                    (update.type !== undefined &&
                        token.type !== update.type &&
                        (!['color', 'gradient'].includes(token.type) ||
                            !['color', 'gradient'].includes(update.type) ||
                            !['web', 'ios', 'android'].every((platform) =>
                                ['light', 'dark'].every((mode) =>
                                    update.values.some((value) => value.platform === platform && value.mode === mode),
                                ),
                            ))),
            )
        )
            return false;
        const stale = entries.some(({ token }) =>
            (Object.keys(sectionTokenTypes) as EditorSection[]).some(
                (section) =>
                    sectionTokenTypes[section]?.includes(token!.type) &&
                    (!this.loaded.has(section) || this.loaded.get(section) !== (this.invalidated.get(section) ?? 0)),
            ),
        );
        if (stale) return false;
        const next = structuredClone(this.snapshot.themeData.variations);
        const revisions = { ...this.snapshot.tokenValueRevisionsByKey };
        const entityIds = { ...this.snapshot.tokenValueEntityIdsByKey };
        let paletteReferencesChanged = false;
        const overridden = { ...this.snapshot.tokenValueOverriddenByKey };
        const definitionsByName = { ...this.snapshot.tokenDefinitionsByName };
        let metaTokens = this.snapshot.themeData.meta.tokens;
        for (const { update, token } of entries) {
            const type = update.type ?? token!.type;
            if (type !== token!.type) {
                const previous = next[token!.type] as unknown as Record<string, Record<string, unknown>>;
                for (const platform of ['web', 'ios', 'android'])
                    for (const mode of ['light', 'dark']) delete previous[platform][`${mode}.${token!.name}`];
                definitionsByName[token!.name] = { ...token!, type };
                metaTokens = metaTokens.map((item) =>
                    ['light', 'dark'].some((mode) => item.name === `${mode}.${token!.name}`) ? { ...item, type } : item,
                );
            }
            const group = next[type] as unknown as Record<string, Record<string, unknown>>;
            for (const value of update.values) {
                const name = value.mode ? `${value.mode}.${token!.name}` : token!.name;
                const previous = (
                    this.snapshot.themeData.variations[token!.type] as unknown as Record<
                        string,
                        Record<string, unknown>
                    >
                )[value.platform]?.[name];
                const references = (input: unknown) =>
                    JSON.stringify(
                        [
                            ...new Set(
                                JSON.stringify(input ?? null).match(/\[(?:general|additional)\.[a-z0-9.-]+\]/gi) ?? [],
                            ),
                        ].sort(),
                    );
                if (references(previous) !== references(value.value)) paletteReferencesChanged = true;
                group[value.platform][name] = storedTokenValue(type, value.value);
                const key = tokenValueKey(update.tokenId, value.platform, value.mode ?? null);
                if (value.entityId) entityIds[key] = value.entityId;
                revisions[key] =
                    value.revision ??
                    tokenValueBaseRevision(this.context, update.tokenId, value.platform, value.mode ?? '');
                if (value.overridden !== undefined) overridden[key] = value.overridden;
            }
        }
        this.snapshot = {
            ...this.snapshot,
            themeData: {
                ...this.snapshot.themeData,
                meta: { ...this.snapshot.themeData.meta, tokens: metaTokens },
                variations: next,
            },
            tokenDefinitionsByName: definitionsByName,
            tokenValueRevisionsByKey: revisions,
            tokenValueEntityIdsByKey: entityIds,
            tokenValueOverriddenByKey: overridden,
        };
        if (paletteReferencesChanged) this.invalidated.set('palette', ++this.generation);
        return true;
    }

    /** Структурный ACK заменяет только затронутое семейство; удалённая инвалидация остаётся приоритетной. */
    acceptColorStructure(structure: ConfirmedColorStructure, values?: ConfirmedTokenValues[]): boolean {
        if (
            this.loaded.get('colors') === undefined ||
            this.loaded.get('colors') !== (this.invalidated.get('colors') ?? 0)
        )
            return false;
        if (structure.definitions.some((token) => token.designSystemId !== this.context.designSystemId)) return false;
        if (
            structure.paletteGroupId &&
            !this.snapshot.palette?.groups.some((group) => group.id === structure.paletteGroupId)
        )
            return false;
        const previousSnapshot = this.snapshot;
        const previous = Object.values(this.snapshot.tokenDefinitionsByName ?? {});
        const previousIds = new Set(previous.map((token) => token.id));
        if (
            structure.definitions.some(
                (token) =>
                    !previousIds.has(token.id) &&
                    !['web', 'ios', 'android'].every((platform) =>
                        ['light', 'dark'].every((mode) =>
                            values?.some(
                                (update) =>
                                    update.tokenId === token.id &&
                                    update.values.some((value) => value.platform === platform && value.mode === mode),
                            ),
                        ),
                    ),
            )
        )
            return false;
        const replaced = new Map(structure.definitions.map((token) => [token.id, token]));
        const removed = new Set(structure.removedTokenIds);
        const variations = structuredClone(this.snapshot.themeData.variations);
        for (const token of previous.filter((token) => replaced.has(token.id) || removed.has(token.id))) {
            const replacement = replaced.get(token.id);
            for (const platform of ['web', 'ios', 'android'])
                for (const mode of ['light', 'dark']) {
                    const name = `${mode}.${token.name}`;
                    const group = variations[token.type] as unknown as Record<string, Record<string, unknown>>;
                    const value = group[platform][name];
                    delete group[platform][name];
                    if (replacement && value !== undefined)
                        (variations[replacement.type] as unknown as Record<string, Record<string, unknown>>)[platform][
                            `${mode}.${replacement.name}`
                        ] = storedTokenValue(replacement.type, value);
                }
        }
        const placements = new Map(structure.placements.map((value) => [value.id, value]));
        const definitions = [
            ...previous.filter((token) => !replaced.has(token.id) && !removed.has(token.id)),
            ...structure.definitions.map((token) => ({ ...previous.find((old) => old.id === token.id), ...token })),
        ].map((token) => ({ ...token, ...placements.get(token.id) }));
        const affectedNames = new Set(
            previous
                .filter((token) => replaced.has(token.id) || removed.has(token.id))
                .flatMap((token) => ['light', 'dark'].map((mode) => `${mode}.${token.name}`)),
        );
        const meta = [
            ...this.snapshot.themeData.meta.tokens.filter((token) => !affectedNames.has(token.name)),
            ...structure.definitions.flatMap((token) =>
                ['light', 'dark'].map((mode) => ({
                    type: token.type,
                    name: `${mode}.${token.name}`,
                    tags: `${mode}.${token.name}`.split('.'),
                    displayName: token.displayName ?? token.name,
                    description: token.description ?? undefined,
                    enabled: token.enabled,
                })),
            ),
        ];
        const palette = this.snapshot.palette;
        const assignments = new Map(
            (palette?.tokens ?? [])
                .filter((token) => !removed.has(token.tokenId))
                .map((token) => [token.tokenId, token]),
        );
        for (const token of structure.definitions) {
            const previous = assignments.get(token.id);
            const explicit = previous?.assignment === 'explicit' ? previous.groupId : structure.paletteGroupId;
            const groupId =
                explicit ?? palette?.groups.find((group) => group.systemKey === defaultGroupForToken(token.name))?.id;
            if (groupId)
                assignments.set(token.id, {
                    tokenId: token.id,
                    tokenName: token.name,
                    groupId,
                    assignment: explicit ? 'explicit' : 'default',
                });
        }
        this.snapshot = {
            ...this.snapshot,
            palette: palette ? { ...palette, tokens: [...assignments.values()] } : undefined,
            tokenDefinitionsByName: Object.fromEntries(definitions.map((token) => [token.name, token])),
            tokenIdsByName: Object.fromEntries(definitions.map((token) => [token.name, token.id])),
            incompleteTokenIds: this.snapshot.incompleteTokenIds.filter((id) => !removed.has(id)),
            themeData: {
                ...this.snapshot.themeData,
                meta: { ...this.snapshot.themeData.meta, tokens: meta },
                variations,
            },
            tokenValueEntityIdsByKey: Object.fromEntries(
                Object.entries(this.snapshot.tokenValueEntityIdsByKey ?? {}).filter(
                    ([key]) => !removed.has(key.split(':')[0]),
                ),
            ),
            tokenValueRevisionsByKey: Object.fromEntries(
                Object.entries(this.snapshot.tokenValueRevisionsByKey).filter(
                    ([key]) => !removed.has(key.split(':')[0]),
                ),
            ),
            tokenValueOverriddenByKey: Object.fromEntries(
                Object.entries(this.snapshot.tokenValueOverriddenByKey ?? {}).filter(
                    ([key]) => !removed.has(key.split(':')[0]),
                ),
            ),
        };
        if (values?.length && !this.acceptConfirmedValues(values)) {
            this.snapshot = previousSnapshot;
            return false;
        }
        this.invalidated.set('palette', ++this.generation);
        this.invalidated.set('components', ++this.generation);
        this.confirmedStructurePending = true;
        return true;
    }

    acceptPalette(palette: NonNullable<ThemeEditorSnapshot['palette']>) {
        this.invalidate(new Set(['theme-tokens']));
        this.snapshot = { ...this.snapshot, palette, paletteError: undefined };
    }

    select(section: EditorSection, component?: string) {
        this.active = { section, component: section === 'components' ? component : undefined };
    }

    async activate(
        section: EditorSection,
        component?: string,
        tokenPending: (type: TokenDefinitionDto['type']) => boolean = () => false,
    ): Promise<SectionReadResult | undefined> {
        this.select(section, component);
        const types = sectionTokenTypes[section] ?? [];
        const hadColors = this.loaded.has('colors');
        const hadComponentData = component ? this.loaded.has(`components:${component}`) : false;
        const componentPending = () =>
            hadComponentData &&
            section === 'components' &&
            component &&
            getDraftAutosaveSourceStatus(this.context, `component:${component}`) !== 'saved';
        const colorPending = () => getDraftAutosaveSourceStatus(this.context, 'color-tokens') !== 'saved';
        if (types.some(tokenPending) || componentPending()) return;
        if (hadColors && types.includes('color') && colorPending()) return;
        if (
            section === 'colors' &&
            this.confirmedStructurePending &&
            this.loaded.get('colors') === (this.invalidated.get('colors') ?? 0)
        ) {
            this.confirmedStructurePending = false;
            return {
                snapshot: this.snapshot,
                tokensChanged: true,
                componentsChanged: false,
                tokenTypes: types,
                activityRevision: getDraftAutosaveRevision(this.context),
            };
        }
        const result = await this.refresh();
        if (!result) return;
        if (result.activityRevision !== getDraftAutosaveRevision(this.context)) {
            // Запись, целиком завершившаяся во время GET, тоже делает ответ устаревшим.
            this.invalidate(new Set(['all']));
            return this.activate(this.active.section, this.active.component, tokenPending);
        }
        const safeTypes = result.tokenTypes.filter(
            (type) => !tokenPending(type) && (!hadColors || !['color', 'gradient'].includes(type) || !colorPending()),
        );
        if (section !== 'components' && safeTypes.length !== result.tokenTypes.length) return;
        if (componentPending()) return;
        return { ...result, tokenTypes: safeTypes };
    }

    invalidateTokenTypes(types: TokenDefinitionDto['type'][]) {
        if (this.context.versionId) return;
        for (const section of Object.keys(sectionTokenTypes) as EditorSection[]) {
            const sectionTypes = sectionTokenTypes[section];
            if (sectionTypes?.some((type) => types.includes(type))) this.invalidated.set(section, ++this.generation);
        }
        // Превью зависит от значений токенов, но сами конфигурации компонентов не менялись.
        // Их зависимости обновятся при следующем открытии через устаревшие разделы токенов.
    }

    invalidate(scopes: Set<DraftInvalidationScope>) {
        if (this.context.versionId) return;
        const all = scopes.has('all') || scopes.has('design-system');
        const zones: EditorSection[] = all
            ? ['colors', 'palette', 'typography', 'shapes', 'components', 'settings', 'changes', 'versions']
            : [];
        if (scopes.has('theme-tokens')) zones.push('colors', 'palette', 'typography', 'shapes', 'components');
        if (scopes.has('component-configurations')) zones.push('components');
        if (scopes.has('theme-metadata'))
            zones.push('settings', 'colors', 'palette', 'typography', 'shapes', 'components');
        for (const section of zones) this.invalidated.set(section, ++this.generation);
        if (all || scopes.has('theme-metadata') || scopes.has('component-configurations')) this.shellStale = true;
    }

    refresh(): Promise<SectionReadResult | undefined> {
        const selected = { ...this.active };
        const read = this.chain.catch(() => undefined).then(() => this.read(selected));
        this.chain = read;
        return read;
    }

    private async read(selected: {
        section: EditorSection;
        component?: string;
    }): Promise<SectionReadResult | undefined> {
        if (this.signal.aborted) throw new Error('EDITOR_CLOSED');
        const activityRevision = getDraftAutosaveRevision(this.context);
        const { section, component } = selected;
        const key = section === 'components' && component ? `components:${component}` : section;
        const generation = this.invalidated.get(section) ?? 0;
        const stale =
            this.loaded.get(key) !== generation ||
            (section === 'components' &&
                component !== undefined &&
                (Date.now() - (this.componentReadAt.get(key) ?? -Infinity) >= 300_000 ||
                    this.componentMetadataRevision.get(key) !== getEditorMetadataRevision(this.context)));
        let tokensChanged = false;
        let componentsChanged = false;
        let types = sectionTokenTypes[section] ?? this.componentTypes.get(key) ?? [];
        if (section === 'palette' && paletteRepository.source === 'local') types = ['color', 'gradient'];
        if (this.shellStale) {
            const shellGeneration = this.generation;
            const shell = await loadThemeShell(this.context, this.signal);
            this.snapshot = {
                ...this.snapshot,
                designSystem: shell.designSystem,
                tenant: shell.tenant,
                parameters: shell.parameters,
                hasComponents: shell.hasComponents,
                themeData: {
                    ...this.snapshot.themeData,
                    meta: { ...this.snapshot.themeData.meta, name: shell.tenant.name },
                },
            };
            this.shellStale = shellGeneration !== this.generation;
        }
        if (stale) {
            if (sectionTokenTypes[section]) {
                const paletteGeneration = this.invalidated.get('palette') ?? 0;
                // Как в структурном редакторе: группы должны быть готовы до чтения размещений токенов.
                const groups =
                    section === 'colors' ? await tokenRepository.loadColorGroups(this.context, this.signal) : undefined;
                const values = await tokenRepository.loadTokenData(
                    this.context,
                    this.signal,
                    this.snapshot.publicationVersion,
                    types,
                    this.loaded.get('palette') === paletteGeneration ? this.snapshot.palette : undefined,
                );
                if (values.paletteError) throw values.paletteError;
                this.snapshot = mergeSectionTokens(this.snapshot, values, types);
                if (groups !== undefined) this.snapshot = { ...this.snapshot, colorTokenGroups: groups };
                if (
                    values.palette &&
                    paletteRepository.source !== 'local' &&
                    paletteGeneration === (this.invalidated.get('palette') ?? 0)
                ) {
                    this.loaded.set('palette', paletteGeneration);
                }
                tokensChanged = true;
            } else if (section === 'palette') {
                if (paletteRepository.source === 'local') {
                    // Связи локальной палитры строятся из цветовых токенов, применённых затем к живой теме.
                    await this.read({ section: 'colors' });
                } else {
                    const palette = await paletteRepository.load(this.context, this.signal);
                    this.snapshot = { ...this.snapshot, palette, paletteError: undefined };
                }
                tokensChanged = true;
            } else if (section === 'components') {
                types = await this.readComponents(component, generation);
                this.componentTypes.set(key, types);
                tokensChanged = types.length > 0;
                componentsChanged = true;
            }
            this.loaded.set(key, generation);
        } else if (section === 'components') {
            // Конфигурация свежая, но значения зависимого раздела могли измениться локально.
            for (const dependency of Object.keys(sectionTokenTypes) as EditorSection[]) {
                if (sectionTokenTypes[dependency]?.some((type) => types.includes(type)))
                    await this.read({ section: dependency });
            }
        }
        if (this.signal.aborted) throw new Error('EDITOR_CLOSED');
        if (this.active.section !== section || this.active.component !== component) return undefined;
        return {
            snapshot: this.snapshot,
            tokensChanged: tokensChanged || types.length > 0,
            componentsChanged: componentsChanged || section === 'components',
            tokenTypes: types,
            activityRevision,
        };
    }

    private async readComponents(
        component: string | undefined,
        generation: number,
    ): Promise<TokenDefinitionDto['type'][]> {
        if (
            this.loaded.get('components') !== generation ||
            this.componentMetadataRevision.get('components') !== getEditorMetadataRevision(this.context)
        ) {
            const index = await componentRepository.loadComponentIndex(this.context, this.signal);
            const existing = [...this.snapshot.componentsData, ...(this.snapshot.composeComponentsData ?? [])];
            const entries = index.map((item) => {
                const cached = existing.find(
                    (current) => current.name === item.name && current.platform === item.platform,
                );
                return cached
                    ? {
                          ...item,
                          sources: cached.sources,
                          serverBinding: { ...cached.serverBinding!, ...item.serverBinding! },
                      }
                    : item;
            });
            this.snapshot = {
                ...this.snapshot,
                componentsData: entries.filter((item) => item.platform === 'web'),
                composeComponentsData: markComposeComponents(entries.filter((item) => item.platform === 'compose')),
            };
            this.loaded.set('components', generation);
            this.componentMetadataRevision.set('components', getEditorMetadataRevision(this.context));
        }
        if (!component) return [];
        const route = parseComponentRoute(component);
        const field = route.platform === 'compose' ? 'composeComponentsData' : 'componentsData';
        const entries = await this.readComponentDependencies(route.name, route.platform, field);
        // Поля выбора токенов и превью требуют целых соответствующих наборов, не всех типов темы безусловно.
        const propertyTypes = new Set(entries.flatMap((item) => item.sources.api.map((property) => property.type)));
        const dependencies: EditorSection[] = ['typography']; // Общий шрифт превью body.
        if (propertyTypes.has('color')) dependencies.push('colors');
        if (['shape', 'dimension', 'shadow'].some((type) => propertyTypes.has(type as never)))
            dependencies.push('shapes');
        for (const section of dependencies) await this.read({ section });
        for (const entry of entries) {
            const prefix = entry.platform === 'compose' ? 'compose-' : '';
            this.loaded.set(`components:${prefix}${entry.name}`, generation);
            this.componentTypes.set(
                `components:${prefix}${entry.name}`,
                dependencies.flatMap((section) => sectionTokenTypes[section] ?? []),
            );
        }
        return dependencies.flatMap((section) => sectionTokenTypes[section] ?? []);
    }

    private async readComponentDependencies(
        name: string,
        platform: 'web' | 'compose',
        field: 'componentsData' | 'composeComponentsData',
    ) {
        const pending = [name];
        const visited = new Set<string>();
        const loaded = [] as ThemeEditorSnapshot['componentsData'];
        while (pending.length) {
            const selectedName = pending.shift()!;
            if (visited.has(selectedName)) continue;
            visited.add(selectedName);
            const cacheKey = `components:${platform === 'compose' ? 'compose-' : ''}${selectedName}`;
            const cached = this.snapshot[field]?.find((item) => item.name === selectedName);
            const response =
                cached &&
                this.loaded.get(cacheKey) === (this.invalidated.get('components') ?? 0) &&
                Date.now() - (this.componentReadAt.get(cacheKey) ?? -Infinity) < 300_000 &&
                this.componentMetadataRevision.get(cacheKey) === getEditorMetadataRevision(this.context)
                    ? [cached]
                    : await componentRepository.loadComponentData(this.context, this.signal, platform, selectedName);
            const entries = platform === 'compose' ? markComposeComponents(response) : response;
            loaded.push(...entries);
            this.componentReadAt.set(cacheKey, Date.now());
            this.componentMetadataRevision.set(cacheKey, getEditorMetadataRevision(this.context));
            this.snapshot = {
                ...this.snapshot,
                [field]: (this.snapshot[field] ?? []).map((item) => {
                    const updated = entries.find(
                        (current) => current.serverBinding?.componentId === item.serverBinding?.componentId,
                    );
                    return updated
                        ? {
                              ...updated,
                              serverBinding: {
                                  ...updated.serverBinding!,
                                  appearanceNames: item.serverBinding?.appearanceNames,
                              },
                          }
                        : item;
                }),
            };
            for (const entry of entries) {
                for (const reference of componentSectionReferences(entry)) {
                    const target = this.snapshot[field]?.find((item) =>
                        item.serverBinding?.appearanceNames?.includes(reference),
                    );
                    if (target) pending.push(target.name);
                }
            }
        }
        return loaded;
    }
}
