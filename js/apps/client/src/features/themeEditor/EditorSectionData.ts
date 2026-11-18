import { colorReadRevision } from './colorReadRevision';
import { defaultGroupForToken } from '../../modules/palette/domain/groups';
import type { ConfirmedTokenValues, ConfirmedColorStructure } from '../../api/draftAutosaveActivity';
import { storedTokenValue } from '../../api/confirmedTokenValues';
import { tokenValueKey } from '../../api/editorHttp';
import { tokenValueBaseRevision } from '../../api/subjectRevisions';
import type {
    DraftRefreshChange,
    EditorContextKey,
    ThemeEditorSnapshot,
    TokenDefinitionDto,
} from '../../api/editorContracts';
import { componentRepository } from '../../api/componentRepository';
import { tokenRepository } from '../../api/tokenRepository';
import { loadThemeShell } from '../../api/themeEditorRepository';
import type { DraftInvalidationScope } from '../../api/draftInvalidationStream';
import { markComposeComponents, parseComponentRoute } from '../../composePreview/composeComponents';
import { paletteRepository } from '../../palette/paletteSession';
import { colorTokenTypes, sectionTokenTypes, type EditorSection } from './editorSections';
import { sectionInvalidation } from './sectionInvalidation';
import { mergeSectionTokens } from './mergeSectionSnapshot';
import { mergeAddressedTokens } from './mergeAddressedTokens';
import { parseMemberName } from '../../modules/colorTokens';
import { componentSectionReferences } from './componentSectionReferences';
import { getEditorMetadataRevision } from '../../api/editorReads';
import { getDraftAutosaveRevision, getDraftAutosaveSourceStatus } from '../../api/draftAutosaveActivity';

const colorTransitions = new Set(['color:gradient', 'gradient:color']);
const colorAddresses = ['web:light', 'web:dark', 'ios:light', 'ios:dark', 'android:light', 'android:dark'];

/** Проверяет полное подтверждение цвета одним индексом вместо повторных поисков по платформам и режимам. */
const completeColorValues = (values: ConfirmedTokenValues['values']) => {
    const addresses = new Set(values.map((value) => `${value.platform}:${value.mode}`));
    return colorAddresses.every(addresses.has, addresses);
};

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
    private colorGroupsStale = true;
    private confirmedStructurePending = false;
    private readonly componentMetadataRevision = new Map<string, number>();
    private shellRead?: Promise<void>;

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

    /** Сверяет известные цветовые семейства после отката без полной загрузки значений раздела. */
    refreshAddressedColors(
        changes: DraftRefreshChange[],
        tokenPending: (type: TokenDefinitionDto['type']) => boolean = () => false,
    ): Promise<boolean> {
        const read = this.chain
            .catch(() => undefined)
            .then(() => this.readAddressedColors(changes, tokenPending))
            .catch((error) => {
                this.invalidate(new Set(['theme-tokens']), changes);
                throw error;
            });
        this.chain = read;
        return read;
    }

    private async readAddressedColors(
        changes: DraftRefreshChange[],
        tokenPending: (type: TokenDefinitionDto['type']) => boolean,
    ): Promise<boolean> {
        const generation = this.generation;
        const revision = colorReadRevision(this.context, this.signal, tokenPending);
        const prerequisites = {
            confirmed: revision !== undefined,
            addressed: changes.length > 0,
            valuesOnly: changes.every((change) => change.entityType === 'token-value'),
            palette: Boolean(this.snapshot.palette),
            loaded: this.loaded.get('colors') === (this.invalidated.get('colors') ?? 0),
        };
        if (!Object.values(prerequisites).every(Boolean)) return false;
        const byEntity = new Map(
            Object.entries(this.snapshot.tokenValueEntityIdsByKey ?? {}).map(([key, id]) => [id, key.split(':')[0]]),
        );
        const ids = new Set(changes.map((change) => byEntity.get(change.entityId)));
        const definitions = Object.values(this.snapshot.tokenDefinitionsByName ?? {});
        const family = (name: string) => {
            const parsed = parseMemberName(name);
            return parsed ? `${parsed.group}.${parsed.name}` : undefined;
        };
        const selected = definitions.filter((token) => ids.has(token.id) && colorTokenTypes.includes(token.type));
        if (selected.length !== ids.size) return false;
        const families = new Set(selected.map((token) => family(token.name)).filter(Boolean));
        const tokenIds = definitions
            .filter(
                (token) =>
                    ids.has(token.id) ||
                    (['color', 'gradient'].includes(token.type) && families.has(family(token.name))),
            )
            .map((token) => token.id);
        if (tokenIds.length > 200) return false;
        const [next, palette] = await Promise.all([
            tokenRepository.loadTokenData(
                this.context,
                this.signal,
                this.snapshot.publicationVersion,
                ['color', 'gradient'],
                this.snapshot.palette,
                tokenIds,
            ),
            paletteRepository.load(this.context, this.signal),
        ]);
        if (revision !== colorReadRevision(this.context, this.signal, tokenPending) || generation !== this.generation)
            return false;
        // Исчезнувшее определение означает структурное изменение: нужен общий путь сверки.
        const confirmed = Object.values(next.tokenDefinitionsByName ?? {});
        if (confirmed.length !== tokenIds.length || next.incompleteTokenIds.length) return false;
        this.snapshot = { ...mergeAddressedTokens(this.snapshot, next, new Set(tokenIds)), palette };
        this.loaded.set('palette', this.invalidated.get('palette') ?? 0);
        this.invalidated.set('components', ++this.generation);
        return true;
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
        const valid = entries.every(({ update, token }) => {
            const previousType = token?.type;
            const unchanged = [undefined, previousType].includes(update.type);
            const confirmation = {
                known: Boolean(token),
                complete: !this.snapshot.incompleteTokenIds.includes(update.tokenId),
                revisions: update.values.every(
                    (value) =>
                        value.revision === undefined ||
                        value.revision >=
                            (this.snapshot.tokenValueRevisionsByKey[
                                tokenValueKey(update.tokenId, value.platform, value.mode ?? null)
                            ] ?? 0),
                ),
                type:
                    unchanged ||
                    (colorTransitions.has(`${previousType}:${update.type}`) && completeColorValues(update.values)),
            };
            return Object.values(confirmation).every(Boolean);
        });
        if (!valid) return false;
        const stale = entries.some(({ token }) =>
            (Object.keys(sectionTokenTypes) as EditorSection[]).some(
                (section) =>
                    sectionTokenTypes[section]?.includes(token!.type) &&
                    this.loaded.get(section) !== (this.invalidated.get(section) ?? 0),
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
                    item.type === token!.type &&
                    ['light', 'dark'].some((mode) => item.name === `${mode}.${token!.name}`)
                        ? { ...item, type }
                        : item,
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
        const previousSnapshot = this.snapshot;
        const previous = Object.values(this.snapshot.tokenDefinitionsByName ?? {});
        const previousIds = new Set(previous.map((token) => token.id));
        const confirmation = {
            loaded: this.loaded.get('colors') === (this.invalidated.get('colors') ?? 0),
            owner: structure.definitions.every((token) => token.designSystemId === this.context.designSystemId),
            paletteGroup:
                !structure.paletteGroupId ||
                this.snapshot.palette?.groups.some((group) => group.id === structure.paletteGroupId),
            values: structure.definitions.every(
                (token) =>
                    previousIds.has(token.id) ||
                    completeColorValues(
                        (values ?? [])
                            .filter((update) => update.tokenId === token.id)
                            .flatMap((update) => update.values),
                    ),
            ),
        };
        if (!Object.values(confirmation).every(Boolean)) return false;
        const replaced = new Map(structure.definitions.map((token) => [token.id, token]));
        const removed = new Set(structure.removedTokenIds);
        const affected = new Set([...replaced.keys(), ...removed]);
        const previousById = new Map(previous.map((token) => [token.id, token] as const).reverse());
        const affectedDefinitions = previous.filter((token) => affected.has(token.id));
        const variations = structuredClone(this.snapshot.themeData.variations);
        for (const token of affectedDefinitions) {
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
            ...previous.filter((token) => !affected.has(token.id)),
            ...structure.definitions.map((token) => ({ ...previousById.get(token.id), ...token })),
        ].map((token) => ({ ...token, ...placements.get(token.id) }));
        const affectedNames = new Set(
            affectedDefinitions.flatMap((token) =>
                ['light', 'dark'].map((mode) => `${token.type}:${mode}.${token.name}`),
            ),
        );
        const meta = [
            ...this.snapshot.themeData.meta.tokens.filter((token) => !affectedNames.has(`${token.type}:${token.name}`)),
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
        const selectedComponent = this.active.component;
        const hadComponentData = selectedComponent ? this.loaded.has(`components:${selectedComponent}`) : false;
        const componentPending = () =>
            hadComponentData &&
            getDraftAutosaveSourceStatus(this.context, `component:${selectedComponent}`) !== 'saved';
        const colorPending = () => hadColors && getDraftAutosaveSourceStatus(this.context, 'color-tokens') !== 'saved';
        if (types.some(tokenPending) || componentPending()) return;
        if (types.includes('color') && colorPending()) return;
        const confirmedStructure = {
            colors: section === 'colors',
            confirmed: this.confirmedStructurePending,
            current: this.loaded.get('colors') === (this.invalidated.get('colors') ?? 0),
        };
        if (Object.values(confirmedStructure).every(Boolean)) {
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
            (type) => !tokenPending(type) && (!colorTokenTypes.includes(type) || !colorPending()),
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

    invalidate(scopes: Set<DraftInvalidationScope>, changes?: DraftRefreshChange[]) {
        if (this.context.versionId) return;
        const plan = sectionInvalidation(scopes, changes);
        for (const section of plan.sections) this.invalidated.set(section, ++this.generation);
        this.colorGroupsStale ||= plan.colorGroups;
        this.shellStale ||= plan.shell;
    }

    refresh(): Promise<SectionReadResult | undefined> {
        const selected = { ...this.active };
        const read = this.chain.catch(() => undefined).then(() => this.read(selected));
        this.chain = read;
        return read;
    }

    /**
     * Индекс компонентов, а с `component` — и данные компонента со связанными компонентами превью, не меняя активный
     * раздел: так канвас раздела «Цвета» получает компонент, не открывая раздел компонентов. Уже загруженное не читается.
     */
    loadComponent(component?: string): Promise<SectionReadResult | undefined> {
        const read = this.chain.catch(() => undefined).then(() => this.readComponentOutsideSection(component));
        this.chain = read;
        return read;
    }

    private async readComponentOutsideSection(component?: string): Promise<SectionReadResult | undefined> {
        if (this.signal.aborted) throw new Error('EDITOR_CLOSED');
        const activityRevision = getDraftAutosaveRevision(this.context);
        if (this.shellStale) await this.readShell();
        const generation = this.invalidated.get('components') ?? 0;
        const key = component ? `components:${component}` : 'components';
        if (this.loaded.get(key) === generation) return undefined;
        const types = await this.readComponents(component, generation);
        if (component) this.componentTypes.set(key, types);
        if (this.signal.aborted) throw new Error('EDITOR_CLOSED');
        return {
            snapshot: this.snapshot,
            tokensChanged: types.length > 0,
            componentsChanged: true,
            tokenTypes: types,
            activityRevision,
        };
    }

    /** Одновременные чтения разделов ждут одно чтение оболочки, а не запускают каждое своё. */
    private readShell(): Promise<void> {
        this.shellRead ??= (async () => {
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
        })().finally(() => {
            this.shellRead = undefined;
        });
        return this.shellRead;
    }

    private async read(selected: {
        section: EditorSection;
        component?: string;
    }): Promise<SectionReadResult | undefined> {
        if (this.signal.aborted) throw new Error('EDITOR_CLOSED');
        const activityRevision = getDraftAutosaveRevision(this.context);
        const { section, component } = selected;
        const key = component ? `components:${component}` : section;
        const generation = this.invalidated.get(section) ?? 0;
        const stale =
            this.loaded.get(key) !== generation ||
            (section === 'components' &&
                component !== undefined &&
                (Date.now() - (this.componentReadAt.get(key) ?? -Infinity) >= 300_000 ||
                    this.componentMetadataRevision.get(key) !== getEditorMetadataRevision(this.context)));
        let tokensChanged = false;
        let types = sectionTokenTypes[section] ?? this.componentTypes.get(key) ?? [];
        if (section === 'palette' && paletteRepository.source === 'local') types = ['color', 'gradient'];
        if (this.shellStale) await this.readShell();
        if (stale) {
            if (sectionTokenTypes[section]) {
                const paletteGeneration = this.invalidated.get('palette') ?? 0;
                // Как в структурном редакторе: группы должны быть готовы до чтения размещений токенов.
                const groups =
                    section === 'colors' && this.colorGroupsStale
                        ? await tokenRepository.loadColorGroups(this.context, this.signal)
                        : undefined;
                const values = await tokenRepository.loadTokenData(
                    this.context,
                    this.signal,
                    this.snapshot.publicationVersion,
                    types,
                    this.loaded.get('palette') === paletteGeneration ? this.snapshot.palette : undefined,
                );
                if (values.paletteError) throw values.paletteError;
                this.snapshot = mergeSectionTokens(this.snapshot, values, types);
                if (groups !== undefined) {
                    this.snapshot = { ...this.snapshot, colorTokenGroups: groups };
                    if (generation === (this.invalidated.get(section) ?? 0)) this.colorGroupsStale = false;
                }
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
            componentsChanged: section === 'components',
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
        // Разделы токенов читаются одновременно и начинаются, как только известны свойства выбранного компонента:
        // их чтение идёт параллельно со связанными компонентами. Каждое чтение вливает токены в текущий снимок.
        const sectionReads = new Map<EditorSection, Promise<unknown>>();
        const startSections = async (entries: ThemeEditorSnapshot['componentsData']) => {
            if (this.shellStale) await this.readShell();
            for (const section of tokenSectionsOf(entries)) {
                if (sectionReads.has(section)) continue;
                const reading = this.read({ section });
                reading.catch(() => undefined);
                sectionReads.set(section, reading);
            }
        };
        const settleSections = async () => {
            const results = await Promise.allSettled(sectionReads.values());
            const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
            if (failure) throw failure.reason;
        };
        let entries: ThemeEditorSnapshot['componentsData'];
        try {
            entries = await this.readComponentDependencies(route.name, route.platform, field, startSections);
            await startSections(entries);
        } catch (error) {
            // Цепочка чтений остаётся последовательной: незавершённые разделы не переживают ошибку.
            await Promise.allSettled(sectionReads.values());
            throw error;
        }
        await settleSections();
        const dependencies = tokenSectionsOf(entries);
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

    /**
     * Обход ссылок по уровням: компоненты уровня читаются одновременно, вливаются в порядке ссылок. Для выбранного
     * web-компонента первый уровень включает и связанные компоненты превью: зависимости (`deps`) и родителей по
     * `compose` — web-плагину нужны их стили.
     */
    private async readComponentDependencies(
        name: string,
        platform: 'web' | 'compose',
        field: 'componentsData' | 'composeComponentsData',
        onSelectedLoaded?: (entries: ThemeEditorSnapshot['componentsData']) => Promise<void>,
    ) {
        const visited = new Set([name]);
        const loaded = [] as ThemeEditorSnapshot['componentsData'];
        let level = [name];
        for (let depth = 0; level.length; depth++) {
            const responses = await Promise.all(
                level.map((selectedName) => this.readComponent(selectedName, platform, field)),
            );
            const next: string[] = [];
            for (const response of responses) {
                const entries = platform === 'compose' ? markComposeComponents(response) : response;
                loaded.push(...entries);
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
                    if (depth === 0 && platform === 'web' && entry.name === name) {
                        for (const related of previewRelatedNames(entry)) {
                            const known = this.snapshot[field]?.some((item) => item.name === related);
                            if (known && !visited.has(related)) {
                                visited.add(related);
                                next.push(related);
                            }
                        }
                    }
                    for (const reference of componentSectionReferences(entry)) {
                        const target = this.snapshot[field]?.find((item) =>
                            item.serverBinding?.appearanceNames?.includes(reference),
                        );
                        if (target && !visited.has(target.name)) {
                            visited.add(target.name);
                            next.push(target.name);
                        }
                    }
                }
            }
            if (depth === 0) await onSelectedLoaded?.(loaded);
            level = next;
        }
        return loaded;
    }

    /** Актуальный кэш или одно чтение компонента по id из записи индекса. */
    private async readComponent(
        name: string,
        platform: 'web' | 'compose',
        field: 'componentsData' | 'composeComponentsData',
    ) {
        const cacheKey = `components:${platform === 'compose' ? 'compose-' : ''}${name}`;
        const cached = this.snapshot[field]?.find((item) => item.name === name);
        const response =
            cached &&
            this.loaded.get(cacheKey) === (this.invalidated.get('components') ?? 0) &&
            Date.now() - (this.componentReadAt.get(cacheKey) ?? -Infinity) < 300_000 &&
            this.componentMetadataRevision.get(cacheKey) === getEditorMetadataRevision(this.context)
                ? [cached]
                : await componentRepository.loadComponentData(
                      this.context,
                      this.signal,
                      platform,
                      name,
                      cached?.serverBinding?.componentId || undefined,
                  );
        this.componentReadAt.set(cacheKey, Date.now());
        this.componentMetadataRevision.set(cacheKey, getEditorMetadataRevision(this.context));
        return response;
    }
}

/** Связанные компоненты превью web-компонента: зависимости любого типа и родители по `compose`. */
const previewRelatedNames = (entry: ThemeEditorSnapshot['componentsData'][number]): string[] => [
    ...(entry.deps ?? []).flatMap((dep) => (dep.childName ? [dep.childName] : [])),
    ...(entry.composeParents ?? []),
];

/** Поля выбора токенов и превью требуют целых соответствующих наборов, не всех типов темы безусловно. */
const tokenSectionsOf = (entries: ThemeEditorSnapshot['componentsData']): EditorSection[] => {
    const propertyTypes = new Set(entries.flatMap((item) => item.sources.api.map((property) => property.type)));
    // Шрифт тела и фон области превью (цветовой токен) нужны любому компоненту, даже без цветовых свойств.
    const sections: EditorSection[] = ['typography', 'colors'];
    if (['shape', 'dimension', 'shadow'].some((type) => propertyTypes.has(type as never))) sections.push('shapes');
    return sections;
};
