import { useCallback, useEffect, useState } from 'react';

import { DesignSystem, Config, Theme } from '../controllers';
import { applyDraftChanges } from '../utils';

export const useDesignSystem = (
    designSystemProjectId?: string,
    designSystemName?: string,
    designSystemVersion?: string,
    includeExtraTokens = true,
) => {
    const [designSystem, setDesignSystem] = useState<DesignSystem | null>(null);
    const [theme, setTheme] = useState<Theme | null>(null);
    const [components, setComponents] = useState<Config[] | null>(null);
    const [reloadTrigger, setReloadTrigger] = useState<object>({});

    useEffect(() => {
        const loadDesignSystems = async () => {
            if (!designSystemName || !designSystemVersion) {
                return;
            }

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
                console.error('[useDesignSystem] Не удалось загрузить дизайн-систему', error);
            }
        };

        loadDesignSystems();
    }, [designSystemName, designSystemVersion, includeExtraTokens, reloadTrigger]);

    const reload = useCallback(() => setReloadTrigger({}), []);

    return { designSystem, theme, components, reload };
};
