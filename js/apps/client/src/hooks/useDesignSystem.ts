import { useCallback, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';

import { DesignSystem, Config, Theme } from '../controllers';
import { applyDraftChanges, setActiveDraftContext } from '../utils';
import { ThemeEditorRepository, type EditorContextKey } from '../api/themeEditorRepository';

const themeEditorRepository = new ThemeEditorRepository();

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

    useEffect(() => {
        const controller = new AbortController();
        const loadDesignSystems = async () => {
            setLoadError(null);
            if (typeof designSystemProjectId === 'object') {
                setActiveDraftContext(designSystemProjectId);
                setDesignSystem(null);
                setTheme(null);
                setComponents(null);
                try {
                    const snapshot = await themeEditorRepository.load(designSystemProjectId, controller.signal);
                    if (controller.signal.aborted) return;
                    const ds = DesignSystem.fromSnapshot({
                        name: snapshot.designSystem.name,
                        parameters: snapshot.parameters,
                        themeData: snapshot.themeData,
                        componentsData: snapshot.componentsData,
                    });
                    setDesignSystem(ds);
                    setIncompleteTokenIds(snapshot.incompleteTokenIds);
                    const selectedTheme = ds.createThemeInstance({ includeExtraTokens });
                    applyDraftChanges(selectedTheme, snapshot.designSystem.name, '0.1.0');
                    setTheme(selectedTheme);
                    setComponents(ds.createAllComponentInstances());
                } catch (error) {
                    if (!controller.signal.aborted) {
                        setLoadError(
                            isAxiosError(error) && error.response?.status === 403
                                ? 'forbidden'
                                : (isAxiosError(error) && error.response?.status === 404) ||
                                    (error instanceof Error && error.message === 'TENANT_DESIGN_SYSTEM_MISMATCH')
                                  ? 'not-found'
                                  : 'failed',
                        );
                        console.error('[useDesignSystem] Не удалось загрузить тему', error);
                    }
                }
                return;
            }
            if (!designSystemName || !designSystemVersion) {
                return;
            }
            setActiveDraftContext(null);

            try {
                const ds = await DesignSystem.get({
                    name: designSystemName,
                    version: designSystemVersion,
                    projectId: designSystemProjectId,
                });
                setDesignSystem(ds);

                const themeInstance = ds.createThemeInstance({ includeExtraTokens });
                applyDraftChanges(themeInstance, designSystemName, designSystemVersion);
                setTheme(themeInstance);

                setComponents(ds.createAllComponentInstances());
            } catch (error) {
                setLoadError(
                    isAxiosError(error) && error.response?.status === 403
                        ? 'forbidden'
                        : isAxiosError(error) && error.response?.status === 404
                          ? 'not-found'
                          : 'failed',
                );
                console.error('[useDesignSystem] Не удалось загрузить дизайн-систему', error);
            }
        };

        loadDesignSystems();
        return () => controller.abort();
    }, [designSystemProjectId, designSystemName, designSystemVersion, includeExtraTokens, reloadTrigger]);

    const reload = useCallback(() => setReloadTrigger({}), []);

    return { designSystem, theme, components, incompleteTokenIds, loadError, reload };
};
