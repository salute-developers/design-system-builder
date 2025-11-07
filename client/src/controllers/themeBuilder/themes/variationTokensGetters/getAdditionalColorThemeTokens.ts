import { type ThemeMode, getRestoredColorFromPalette } from '@salutejs/plasma-tokens-utils';

import type { PlatformType, PlatformsVariations } from '../../types';
import { getStateColor } from '../../../../_new/utils';
import { sectionToFormulaMap } from '../../../../_new/types';

import { ColorToken } from '../../tokens';

export const getAdditionalColorThemeTokens = (
    token: ColorToken,
): PlatformsVariations['color'][PlatformType] | undefined => {
    const [mode, category] = token.getName().split('.') as [ThemeMode, string];

    const sectionName = sectionToFormulaMap[category];

    if (!sectionName) {
        return undefined;
    }

    const value = token.getValue('web');
    const restoredValue = getRestoredColorFromPalette(value, -1);
    const getDefaultStateToken = getStateColor(restoredValue, sectionName, mode);

    return {
        [`${token.getName()}-hover`]: getDefaultStateToken('hover'),
        [`${token.getName()}-active`]: getDefaultStateToken('active'),
        [`${token.getName()}-brightness`]: getDefaultStateToken('brightness'),
    };
};
