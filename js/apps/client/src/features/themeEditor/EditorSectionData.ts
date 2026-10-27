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
    private readonly componentTypes = new Map<string, TokenDefinitionDto['type'][]>();
    private chain: Promise<unknown> = Promise.resolve();
    private shellStale = false;
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
        this.shellStale = true;
    }

    refresh(): Promise<SectionReadResult | undefined> {
        const selected = { ...this.active };
        const read = this.chain.catch(() => undefined).then(() => this.read(selected));
        this.chain = read;
        return read;
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
        const key = section === 'components' && component ? `components:${component}` : section;
        const generation = this.invalidated.get(section) ?? 0;
        const stale = this.loaded.get(key) !== generation;
        let tokensChanged = false;
        let componentsChanged = false;
        let types = sectionTokenTypes[section] ?? this.componentTypes.get(key) ?? [];
        if (section === 'palette' && paletteRepository.source === 'local') types = ['color', 'gradient'];
        if (this.shellStale) await this.readShell();
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
        if (this.loaded.get('components') !== generation) {
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
        if (cached && this.loaded.get(cacheKey) === (this.invalidated.get('components') ?? 0)) return [cached];
        return componentRepository.loadComponentData(
            this.context,
            this.signal,
            platform,
            name,
            cached?.serverBinding?.componentId || undefined,
        );
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
