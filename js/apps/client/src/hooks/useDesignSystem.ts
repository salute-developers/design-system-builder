import { useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';

import { DesignSystem, Config, Theme } from '../controllers';
import { applyDraftChanges, setActiveDraftContext } from '../utils';
import { loadThemeEditor } from '../api/themeEditorRepository';
import type { EditorContextKey, ThemeEditorSnapshot, DraftChangeDto } from '../api/editorContracts';
import type { AutosaveStatus } from '../api/tokenAutosaveQueue';
import { ThemeEditorSession } from '../features/themeEditor/ThemeEditorSession';

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
        const controller = new AbortController();
        const loadDesignSystems = async () => {
            setLoadError(null);
            if (typeof designSystemProjectId === 'object') {
                const historicalMode = Boolean(designSystemProjectId.versionId);
                setActiveDraftContext(historicalMode ? null : designSystemProjectId);
                setDesignSystem(null);
                setTheme(null);
                setComponents(null);
                const applySnapshot = (
                    snapshot: ThemeEditorSnapshot,
                    tokensChanged: boolean,
                    componentsChanged: boolean,
                ) => {
                    const nextDesignSystem = DesignSystem.fromSnapshot({
                        name: snapshot.designSystem.name,
                        version: snapshot.publicationVersion,
                        parameters: snapshot.parameters,
                        themeData: snapshot.themeData,
                        componentsData: snapshot.componentsData,
                    });
                    setDesignSystem(nextDesignSystem);
                    if (tokensChanged) {
                        setIncompleteTokenIds(snapshot.incompleteTokenIds);
                        const nextTheme = nextDesignSystem.createThemeInstance({ includeExtraTokens });
                        if (!historicalMode) applyDraftChanges(nextTheme, snapshot.designSystem.name, '0.1.0');
                        setTheme(nextTheme);
                    }
                    if (componentsChanged) setComponents(nextDesignSystem.createAllComponentInstances());
                };
                try {
                    const snapshot = await loadThemeEditor(designSystemProjectId, controller.signal);
                    if (controller.signal.aborted) return;
                    applySnapshot(snapshot, true, true);
                    if (!historicalMode) {
                        const session = new ThemeEditorSession({
                            context: designSystemProjectId,
                            snapshot,
                            signal: controller.signal,
                            onSaved: () => setLastSave({ key: autosaveContextKey, time: Date.now() }),
                            onStatus: setAutosaveStatus,
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
        return () => controller.abort();
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
    const refreshChanges = useCallback((changes: DraftChangeDto[]) => {
        const session = autosaveSession.current;
        if (!session) return Promise.reject(new Error('Редактор черновика недоступен'));
        return session.refreshChanges(changes);
    }, []);

    return {
        designSystem,
        theme,
        components,
        incompleteTokenIds,
        loadError,
        reload,
        autosaveStatus,
        lastSavedAt: lastSave?.key === autosaveContextKey ? lastSave.time : undefined,
        retryAutosave,
        refreshChanges,
    };
};
