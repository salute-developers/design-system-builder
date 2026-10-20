import { useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { observeTokenValueRevisions, observeSubjectAddresses } from '../api/subjectRevisions';

import { DesignSystem, Config, Theme } from '../controllers';
import { applyDraftChanges, pendingDraftTokens, setActiveDraftContext } from '../utils';
import { loadThemeEditor, loadThemeShell } from '../api/themeEditorRepository';
import { EditorSectionData } from '../features/themeEditor/EditorSectionData';
import { sectionTokenTypes, type EditorSection } from '../features/themeEditor/editorSections';
import { invalidateEditorReads } from '../api/editorReads';
import type { EditorContextKey, ThemeEditorSnapshot, DraftChangeDto, TokenDefinitionDto } from '../api/editorContracts';
import type { AutosaveStatus } from '../api/tokenAutosaveQueue';
import { ThemeEditorSession } from '../features/themeEditor/ThemeEditorSession';
import { preservePendingComponents } from '../features/themeEditor/preservePendingComponents';
import type { ThemePalette } from '../modules/palette';
import { getActivePalette, setActivePalette } from '../palette/activePalette';
import { paletteRepository, setPaletteSession } from '../palette/paletteSession';
import { getDraftAutosaveStatus, recordDraftSave, subscribeDraftAutosaveStatus } from '../api/draftAutosaveActivity';

const loadErrorFor = (error: unknown): 'forbidden' | 'not-found' | 'failed' => {
    if (isAxiosError(error)) {
        return ({ 403: 'forbidden', 404: 'not-found' } as const)[error.response?.status ?? 0] ?? 'failed';
    }
    return [error instanceof Error, (error as Error)?.message === 'TENANT_DESIGN_SYSTEM_MISMATCH'].every(Boolean)
        ? 'not-found'
        : 'failed';
};

export const useDesignSystem = (
    designSystemProjectId?: EditorContextKey,
    includeExtraTokens = true,
    selection?: { section: EditorSection; component?: string },
) => {
    const [designSystem, setDesignSystem] = useState<DesignSystem | null>(null);
    const [theme, setTheme] = useState<Theme | null>(null);
    const [components, setComponents] = useState<Config[] | null>(null);
    const [composeComponents, setComposeComponents] = useState<Config[]>([]);
    const [hasConfiguredComponents, setHasConfiguredComponents] = useState(false);
    const [tokenDefinitions, setTokenDefinitions] = useState<TokenDefinitionDto[]>([]);
    const [colorTokenGroups, setColorTokenGroups] = useState<ThemeEditorSnapshot['colorTokenGroups']>();
    const [palette, setPaletteState] = useState<ThemePalette | null>(null);
    const [paletteError, setPaletteError] = useState<Error | null>(null);
    const tenantRef = useRef<string>();
    const [incompleteTokenIds, setIncompleteTokenIds] = useState<string[]>([]);
    const [loadError, setLoadError] = useState<'forbidden' | 'not-found' | 'failed' | null>(null);
    const [reloadTrigger, setReloadTrigger] = useState<object>({});
    const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('saved');
    const autosaveContextKey = designSystemProjectId
        ? [designSystemProjectId.projectId, designSystemProjectId.designSystemId, designSystemProjectId.tenantId].join(
              ':',
          )
        : '';
    const [lastSave, setLastSave] = useState<{ key: string; time: number }>();
    const autosaveSession = useRef<ThemeEditorSession | null>(null);
    const sectionData = useRef<EditorSectionData>();
    const sectionLoader = useRef<() => Promise<void>>();
    const selectionRef = useRef(selection);
    selectionRef.current = selection;
    const sectionKey = JSON.stringify([
        autosaveContextKey,
        typeof designSystemProjectId === 'object' ? designSystemProjectId.versionId : undefined,
        selection,
    ]);
    const currentSectionKey = useRef(sectionKey);
    currentSectionKey.current = sectionKey;
    const [sectionState, setSectionState] = useState<{ key: string; error?: string }>();

    useEffect(() => {
        void sectionLoader.current?.();
    }, [sectionKey]);

    useEffect(() => {
        if (typeof designSystemProjectId !== 'object' || designSystemProjectId.versionId) return;
        let observedSave: number | undefined;
        return subscribeDraftAutosaveStatus(designSystemProjectId, (status, time) => {
            setAutosaveStatus(status);
            if (time !== undefined) {
                setLastSave({ key: autosaveContextKey, time });
                if (time !== observedSave) sectionData.current?.invalidate(new Set(['all']));
                observedSave = time;
            }
            void sectionLoader.current?.();
        });
    }, [designSystemProjectId, autosaveContextKey]);

    useEffect(() => {
        const controller = new AbortController();
        sectionData.current = undefined;
        sectionLoader.current = undefined;
        const loadDesignSystems = async () => {
            setLoadError(null);
            setActivePalette(null);
            setPaletteSession(null);
            setPaletteState(null);
            setColorTokenGroups(undefined);
            setPaletteError(null);
            tenantRef.current = typeof designSystemProjectId === 'object' ? designSystemProjectId.tenantId : undefined;
            if (typeof designSystemProjectId === 'object') {
                const historicalMode = Boolean(designSystemProjectId.versionId);
                setActiveDraftContext(historicalMode ? null : designSystemProjectId);
                setDesignSystem(null);
                setTheme(null);
                setComponents(null);
                setComposeComponents([]);
                let localPaletteRead = 0;
                const applySnapshot = (
                    snapshot: ThemeEditorSnapshot,
                    tokensChanged: boolean,
                    componentsChanged: boolean,
                ) => {
                    const nextPalette =
                        paletteRepository.source === 'local' ? getActivePalette() : (snapshot.palette ?? null);
                    const nextDesignSystem = DesignSystem.fromSnapshot({
                        name: snapshot.designSystem.name,
                        version: snapshot.publicationVersion,
                        parameters: snapshot.parameters,
                        themeData: snapshot.themeData,
                        componentsData: snapshot.componentsData,
                        composeComponentsData: snapshot.composeComponentsData,
                    });
                    setDesignSystem(nextDesignSystem);
                    setHasConfiguredComponents(
                        snapshot.hasComponents ??
                            Boolean(snapshot.componentsData.length || snapshot.composeComponentsData?.length),
                    );
                    if (tokensChanged) {
                        setIncompleteTokenIds(snapshot.incompleteTokenIds);
                        const definitions = Object.values(snapshot.tokenDefinitionsByName ?? {});
                        setTokenDefinitions(definitions);
                        setColorTokenGroups(snapshot.colorTokenGroups);
                        // Формулы зависимых цветов должны видеть уже новую палитру.
                        setActivePalette(nextPalette);
                        const nextTheme = nextDesignSystem.createThemeInstance({ includeExtraTokens });
                        if (!historicalMode) applyDraftChanges(nextTheme, snapshot.designSystem.name, '0.1.0');
                        setPaletteSession({
                            context: designSystemProjectId,
                            designSystem: nextDesignSystem,
                            theme: nextTheme,
                            tokens: definitions
                                .filter((token) => token.type === 'color')
                                .map((token) => ({ id: token.id, name: token.name, displayName: token.displayName })),
                            readOnly: snapshot.parameters.readOnly === true,
                        });
                        setPaletteState(nextPalette);
                        setPaletteError(snapshot.paletteError ?? null);
                        setTheme(nextTheme);
                        if (selectionRef.current && sectionData.current && paletteRepository.source === 'local') {
                            const read = ++localPaletteRead;
                            void paletteRepository.load(designSystemProjectId, controller.signal).then(
                                (next) => {
                                    if (controller.signal.aborted || read !== localPaletteRead) return;
                                    setActivePalette(next);
                                    setPaletteState(next);
                                    setPaletteError(null);
                                },
                                (error) => {
                                    if (!controller.signal.aborted && read === localPaletteRead)
                                        setPaletteError(error instanceof Error ? error : new Error(String(error)));
                                },
                            );
                        }
                    }
                    if (tokensChanged) {
                        observeTokenValueRevisions(designSystemProjectId, snapshot);
                        observeSubjectAddresses(
                            designSystemProjectId,
                            'palette',
                            snapshot.palette?.subjectRevisions ?? {},
                        );
                    }
                    if (componentsChanged) {
                        setComponents((current) =>
                            preservePendingComponents(
                                designSystemProjectId,
                                current,
                                nextDesignSystem.createAllComponentInstances(),
                            ),
                        );
                        setComposeComponents((current) =>
                            preservePendingComponents(
                                designSystemProjectId,
                                current,
                                nextDesignSystem.createAllComposeComponentInstances(),
                            ),
                        );
                    }
                };
                try {
                    const snapshot = selectionRef.current
                        ? await loadThemeShell(designSystemProjectId, controller.signal)
                        : await loadThemeEditor(designSystemProjectId, controller.signal);
                    if (controller.signal.aborted) return;
                    applySnapshot(snapshot, true, true);
                    if (selectionRef.current) {
                        const sections = new EditorSectionData(designSystemProjectId, snapshot, controller.signal);
                        // Только восстановление реально неподтверждённых правок нуждается в данных скрытой зоны.
                        const pendingTypes = new Set(
                            Object.values(pendingDraftTokens(snapshot.designSystem.name, '0.1.0')).map(
                                (change) => change.type,
                            ),
                        );
                        for (const zone of ['colors', 'typography', 'shapes'] as const) {
                            const types = sectionTokenTypes[zone] ?? [];
                            if (types.some((type) => pendingTypes.has(type)))
                                await sections.activate(zone as EditorSection);
                        }
                        if (controller.signal.aborted) return;
                        const session = new ThemeEditorSession({
                            context: designSystemProjectId,
                            snapshot: sections.currentSnapshot,
                            signal: controller.signal,
                            sections,
                            onSaved: () => recordDraftSave(designSystemProjectId),
                            onStatus: () => setAutosaveStatus(getDraftAutosaveStatus(designSystemProjectId)),
                            onSnapshot: (next, tokensChanged, componentsChanged) => {
                                applySnapshot(next, tokensChanged, componentsChanged);
                                if (
                                    selectionRef.current?.section === sections.activeSection &&
                                    selectionRef.current?.component === sections.activeComponent
                                )
                                    setSectionState({ key: currentSectionKey.current });
                            },
                            onDisposed: () => {
                                if (autosaveSession.current === session) autosaveSession.current = null;
                            },
                        });
                        sectionData.current = sections;
                        autosaveSession.current = session;
                        const loadSection = async () => {
                            const selected = selectionRef.current;
                            if (!selected || controller.signal.aborted) return;
                            const key = currentSectionKey.current;
                            try {
                                await session.activateSection(selected.section, selected.component);
                                if (!controller.signal.aborted && currentSectionKey.current === key)
                                    setSectionState({ key });
                            } catch (error) {
                                if (!controller.signal.aborted && currentSectionKey.current === key)
                                    setSectionState({
                                        key,
                                        error: error instanceof Error ? error.message : 'Не удалось загрузить раздел',
                                    });
                            }
                        };
                        sectionLoader.current = loadSection;
                        await loadSection();
                        if (!historicalMode && !controller.signal.aborted) session.start();
                        return;
                    }
                    if (paletteRepository.source === 'local') {
                        try {
                            const localPalette = await paletteRepository.load(designSystemProjectId, controller.signal);
                            if (controller.signal.aborted) return;
                            setActivePalette(localPalette);
                            setPaletteState(localPalette);
                        } catch (error) {
                            if (controller.signal.aborted) return;
                            setPaletteError(error instanceof Error ? error : new Error(String(error)));
                        }
                    }
                    if (!historicalMode) {
                        const session = new ThemeEditorSession({
                            context: designSystemProjectId,
                            snapshot,
                            signal: controller.signal,
                            onSaved: () => recordDraftSave(designSystemProjectId),
                            onStatus: () => setAutosaveStatus(getDraftAutosaveStatus(designSystemProjectId)),
                            onSnapshot: applySnapshot,
                            onDisposed: () => {
                                if (autosaveSession.current === session) autosaveSession.current = null;
                            },
                        });
                        autosaveSession.current = session;
                        session.start();
                    }
                } catch (error) {
                    if (!controller.signal.aborted) {
                        setLoadError(loadErrorFor(error));
                        console.error('[useDesignSystem] Не удалось загрузить тему', error);
                    }
                }
                return;
            }
            // Редактор открывается только в контексте темы: загрузки по имени и версии ДС больше нет.
            setActiveDraftContext(null);
        };

        loadDesignSystems();
        return () => {
            controller.abort();
            sectionLoader.current = undefined;
            sectionData.current = undefined;
            setActivePalette(null);
            setPaletteSession(null);
        };
    }, [designSystemProjectId, includeExtraTokens, reloadTrigger, autosaveContextKey]);

    const reload = useCallback(() => {
        if (sectionData.current) {
            sectionData.current.invalidate(new Set(['all']));
            invalidateEditorReads();
            void sectionLoader.current?.();
        } else setReloadTrigger({});
    }, []);
    const retryAutosave = useCallback(() => autosaveSession.current?.retryFailed(), []);
    const setPalette = useCallback(
        (next: ThemePalette) => {
            if (next.tenantId !== tenantRef.current) return;
            sectionData.current?.acceptPalette(next);
            if (typeof designSystemProjectId === 'object')
                observeSubjectAddresses(designSystemProjectId, 'palette', next.subjectRevisions ?? {});
            setActivePalette(next);
            setPaletteState(next);
            setPaletteError(null);
        },
        [designSystemProjectId],
    );
    const refreshChanges = useCallback((changes: DraftChangeDto[]) => {
        const session = autosaveSession.current;
        if (!session) return Promise.reject(new Error('Редактор черновика недоступен'));
        return session.refreshChanges(changes);
    }, []);

    return {
        designSystem,
        theme,
        components,
        hasConfiguredComponents,
        composeComponents,
        tokenDefinitions,
        colorTokenGroups,
        palette,
        paletteError,
        setPalette,
        incompleteTokenIds,
        loadError,
        sectionLoading: Boolean(selection && sectionState?.key !== sectionKey),
        sectionError: sectionState?.key === sectionKey ? sectionState.error : undefined,
        reload,
        autosaveStatus,
        lastSavedAt: lastSave?.key === autosaveContextKey ? lastSave.time : undefined,
        retryAutosave,
        refreshChanges,
    };
};
