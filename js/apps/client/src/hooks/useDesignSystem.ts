import { useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';

import { DesignSystem, Config, Theme } from '../controllers';
import { applyDraftChanges, setActiveDraftContext } from '../utils';
import { ThemeEditorRepository, type EditorContextKey } from '../api/themeEditorRepository';
import type { ThemePalette } from '../modules/palette';
import { setActivePalette } from '../palette/activePalette';
import { paletteRepository, setPaletteSession } from '../palette/paletteSession';

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
    const [palette, setPaletteState] = useState<ThemePalette | null>(null);
    const [paletteError, setPaletteError] = useState<Error | null>(null);
    // Тема, для которой сейчас загружена палитра: ответы для прежней темы отбрасываются.
    const tenantRef = useRef<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        const loadDesignSystems = async () => {
            setLoadError(null);
            setActivePalette(null);
            setPaletteSession(null);
            setPaletteState(null);
            setPaletteError(null);
            tenantRef.current = typeof designSystemProjectId === 'object' ? designSystemProjectId.tenantId : null;
            if (typeof designSystemProjectId === 'object') {
                setActiveDraftContext(designSystemProjectId);
                setDesignSystem(null);
                setTheme(null);
                setComponents(null);
                // В режиме api палитра запрашивается параллельно с темой и не задерживает её загрузку.
                const earlyPalette =
                    paletteRepository.source === 'api'
                        ? paletteRepository.load(designSystemProjectId, controller.signal).then(
                              (value) => ({ value }),
                              (error: unknown) => ({ error }),
                          )
                        : null;
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
                    setPaletteSession({
                        context: designSystemProjectId,
                        designSystem: ds,
                        theme: selectedTheme,
                        tokens: snapshot.tokenDefinitions
                            .filter((token) => token.type === 'color')
                            .map((token) => ({ id: token.id, name: token.name, displayName: token.displayName })),
                        readOnly: snapshot.parameters.readOnly === true,
                    });
                    try {
                        const early = earlyPalette ? await earlyPalette : null;
                        if (early && 'error' in early) throw early.error;
                        const loadedPalette = early
                            ? early.value
                            : await paletteRepository.load(designSystemProjectId, controller.signal);
                        if (controller.signal.aborted) return;
                        setActivePalette(loadedPalette);
                        setPaletteState(loadedPalette);
                    } catch (error) {
                        if (controller.signal.aborted) return;
                        setPaletteError(error instanceof Error ? error : new Error(String(error)));
                        console.error('[useDesignSystem] Не удалось загрузить палитру темы', error);
                    }
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
        return () => {
            controller.abort();
            setActivePalette(null);
        };
    }, [designSystemProjectId, designSystemName, designSystemVersion, includeExtraTokens, reloadTrigger]);

    const reload = useCallback(() => setReloadTrigger({}), []);

    /** Обновляет палитру открытой темы после операции; превью перечитывают активную палитру. */
    const setPalette = useCallback((next: ThemePalette) => {
        if (next.tenantId !== tenantRef.current) return;
        setActivePalette(next);
        setPaletteState(next);
        setPaletteError(null);
    }, []);

    return {
        designSystem,
        theme,
        components,
        incompleteTokenIds,
        loadError,
        reload,
        palette,
        paletteError,
        setPalette,
    };
};
