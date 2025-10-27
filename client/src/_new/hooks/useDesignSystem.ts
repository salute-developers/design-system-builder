import { useEffect, useState } from 'react';

import { DesignSystem } from '../../designSystem';
import { Theme } from '../../themeBuilder';

export const useDesignSystem = (
    designSystemName?: string,
    designSystemVersion?: string,
    includeExtraTokens = false,
) => {
    const [designSystem, setDesignSystem] = useState<DesignSystem | null>(null);
    const [theme, setTheme] = useState<Theme | null>(null);

    useEffect(() => {
        const loadDesignSystems = async () => {
            if (!designSystemName || !designSystemVersion) {
                return;
            }

            const ds = await DesignSystem.get({ name: designSystemName, version: designSystemVersion });
            setDesignSystem(ds);
            setTheme(
                ds.createThemeInstance({
                    includeExtraTokens,
                }),
            );
        };

        loadDesignSystems();
    }, [designSystemName, designSystemVersion, includeExtraTokens]);

    return { designSystem, theme };
};
