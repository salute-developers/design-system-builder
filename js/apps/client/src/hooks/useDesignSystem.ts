import { useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { observeTokenValueRevisions, observeSubjectAddresses } from '../api/subjectRevisions';

import { DesignSystem, Config, Theme } from '../controllers';
import { applyDraftChanges, setActiveDraftContext } from '../utils';
import { loadThemeEditor } from '../api/themeEditorRepository';
import type { EditorContextKey, ThemeEditorSnapshot, DraftChangeDto, TokenDefinitionDto } from '../api/editorContracts';
import type { AutosaveStatus } from '../api/tokenAutosaveQueue';
import { ThemeEditorSession } from '../features/themeEditor/ThemeEditorSession';
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
    designSystemProjectId?: string | EditorContextKey,
    designSystemName?: string,
    designSystemVersion?: string,
    includeExtraTokens = true,
) => {
    const [designSystem, setDesignSystem] = useState<DesignSystem | null>(null);
    const [theme, setTheme] = useState<Theme | null>(null);
    const [components, setComponents] = useState<Config[] | null>(null);
    const [composeComponents, setComposeComponents] = useState<Config[]>([]);
    const [tokenDefinitions, setTokenDefinitions] = useState<TokenDefinitionDto[]>([]);
    const [palette, setPaletteState] = useState<ThemePalette | null>(null);
    const [paletteError, setPaletteError] = useState<Error | null>(null);
    const tenantRef = useRef<string>();
    const [incompleteTokenIds, setIncompleteTokenIds] = useState<string[]>([]);
    const [loadError, setLoadError] = useState<'forbidden' | 'not-found' | 'failed' | null>(null);
    const [reloadTrigger, setReloadTrigger] = useState<object>({});
    const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('saved');
    const autosaveContextKey =
        typeof designSystemProjectId === 'object'
            ? [
                  designSystemProjectId.projectId,
                  designSystemProjectId.designSystemId,
                  designSystemProjectId.tenantId,
              ].join(':')
            : [designSystemProjectId, designSystemName, designSystemVersion].join(':');
    const [lastSave, setLastSave] = useState<{ key: string; time: number }>();
    const autosaveSession = useRef<ThemeEditorSession | null>(null);

    useEffect(() => {
        if (typeof designSystemProjectId !== 'object' || designSystemProjectId.versionId) return;
        return subscribeDraftAutosaveStatus(designSystemProjectId, (status, time) => {
            setAutosaveStatus(status);
            if (time !== undefined) setLastSave({ key: autosaveContextKey, time });
        });
    }, [designSystemProjectId, autosaveContextKey]);

    useEffect(() => {
        const controller = new AbortController();
        const loadDesignSystems = async () => {
            setLoadError(null);
            setActivePalette(null);
            setPaletteSession(null);
            setPaletteState(null);
            setPaletteError(null);
            tenantRef.current = typeof designSystemProjectId === 'object' ? designSystemProjectId.tenantId : undefined;
            if (typeof designSystemProjectId === 'object') {
                const historicalMode = Boolean(designSystemProjectId.versionId);
                setActiveDraftContext(historicalMode ? null : designSystemProjectId);
                setDesignSystem(null);
                setTheme(null);
                setComponents(null);
                setComposeComponents([]);
                const applySnapshot = (
                    snapshot: ThemeEditorSnapshot,
                    tokensChanged: boolean,
                    componentsChanged: boolean,
                ) => {
                    const nextPalette =
                        snapshot.palette ?? (paletteRepository.source === 'local' ? getActivePalette() : null);
                    const nextDesignSystem = DesignSystem.fromSnapshot({
                        name: snapshot.designSystem.name,
                        version: snapshot.publicationVersion,
                        parameters: snapshot.parameters,
                        themeData: snapshot.themeData,
                        componentsData: snapshot.componentsData,
                        composeComponentsData: snapshot.composeComponentsData,
                    });
                    setDesignSystem(nextDesignSystem);
                    if (tokensChanged) {
                        setIncompleteTokenIds(snapshot.incompleteTokenIds);
                        const definitions = Object.values(snapshot.tokenDefinitionsByName ?? {});
                        setTokenDefinitions(definitions);
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
                        setComponents(nextDesignSystem.createAllComponentInstances());
                        setComposeComponents(nextDesignSystem.createAllComposeComponentInstances());
                    }
                };
                try {
                    const snapshot = await loadThemeEditor(designSystemProjectId, controller.signal);
                    if (controller.signal.aborted) return;
                    applySnapshot(snapshot, true, true);
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
            if ([designSystemName, designSystemVersion].some((value) => !value)) {
                return;
            }
            setActiveDraftContext(null);

            try {
                const ds = await DesignSystem.get({
                    name: designSystemName!,
                    version: designSystemVersion!,
                    projectId: designSystemProjectId,
                });
                setDesignSystem(ds);

                const themeInstance = ds.createThemeInstance({ includeExtraTokens });
                applyDraftChanges(themeInstance, designSystemName!, designSystemVersion!);
                setTheme(themeInstance);

                setComponents(ds.createAllComponentInstances());
            } catch (error) {
                setLoadError(loadErrorFor(error));
                console.error('[useDesignSystem] Не удалось загрузить дизайн-систему', error);
            }
        };

        loadDesignSystems();
        return () => {
            controller.abort();
            setActivePalette(null);
            setPaletteSession(null);
        };
    }, [
        designSystemProjectId,
        designSystemName,
        designSystemVersion,
        includeExtraTokens,
        reloadTrigger,
        autosaveContextKey,
    ]);

    const reload = useCallback(() => setReloadTrigger({}), []);
    const retryAutosave = useCallback(() => autosaveSession.current?.retryFailed(), []);
    const setPalette = useCallback(
        (next: ThemePalette) => {
            if (next.tenantId !== tenantRef.current) return;
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
        composeComponents,
        tokenDefinitions,
        palette,
        paletteError,
        setPalette,
        incompleteTokenIds,
        loadError,
        reload,
        autosaveStatus,
        lastSavedAt: lastSave?.key === autosaveContextKey ? lastSave.time : undefined,
        retryAutosave,
        refreshChanges,
    };
};
