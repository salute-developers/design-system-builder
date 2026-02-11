import { useEffect, useState } from 'react';

import { DesignSystem, Config, Theme } from '../controllers';
import { applyDraftChanges } from '../utils';

export const useDesignSystem = (designSystemName?: string, designSystemVersion?: string, includeExtraTokens = true) => {
    const [designSystem, setDesignSystem] = useState<DesignSystem | null>(null);
    const [theme, setTheme] = useState<Theme | null>(null);
    const [components, setComponents] = useState<Config[] | null>(null);

    useEffect(() => {
        const loadDesignSystems = async () => {
            if (!designSystemName || !designSystemVersion) {
                return;
            }

            const ds = await DesignSystem.get({ name: designSystemName, version: designSystemVersion });
            setDesignSystem(ds);

            const themeInstance = ds.createThemeInstance({ includeExtraTokens });
            applyDraftChanges(themeInstance, designSystemName, designSystemVersion);
            setTheme(themeInstance);

            setComponents(ds.createAllComponentInstances());
        };

        loadDesignSystems();
    }, [designSystemName, designSystemVersion, includeExtraTokens]);

    return { designSystem, theme, components };
};
