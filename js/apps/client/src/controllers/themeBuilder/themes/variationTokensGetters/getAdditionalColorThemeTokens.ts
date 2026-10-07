import { type ThemeMode } from '@salutejs/plasma-tokens-utils';

import type { PlatformType, PlatformsVariations } from '../../types';
import { getStateColor } from '../../../../utils';
import { sectionToFormulaMap } from '../../../../types';

import { ColorToken } from '../../tokens';
import { restorePaletteColor } from '../../../../palette/activePalette';

export const getAdditionalColorThemeTokens = (
    token: ColorToken,
): PlatformsVariations['color'][PlatformType] | undefined => {
    const [mode, category] = token.getName().split('.') as [ThemeMode, string];

    const sectionName = sectionToFormulaMap[category];

    if (!sectionName) {
        return undefined;
    }

    const value = token.getValue('web');
    const restoredValue = restorePaletteColor(value, -1, token.getName());
    const getDefaultStateToken = getStateColor(restoredValue, sectionName, mode);

    return {
        [`${token.getName()}-hover`]: getDefaultStateToken('hover'),
        [`${token.getName()}-active`]: getDefaultStateToken('active'),
        [`${token.getName()}-brightness`]: getDefaultStateToken('brightness'),
    };
};
