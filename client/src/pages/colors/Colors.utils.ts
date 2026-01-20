import { getRestoredColorFromPalette, ThemeMode } from '@salutejs/plasma-tokens-utils';

import { getStateColor } from '../../utils';
import { sectionToFormulaMap } from '../../types';

export const getAdditionalColorValues = (value: string, themeMode: string, groupName: string, subgroupName: string) => {
    const sectionName = sectionToFormulaMap[groupName.toLocaleLowerCase()];

    if (!sectionName) {
        return undefined;
    }

    let mode = themeMode as ThemeMode;

    if (
        (themeMode === 'dark' && (subgroupName === 'default' || subgroupName.includes('dark'))) ||
        (themeMode === 'light' && (subgroupName === 'inverse' || subgroupName.includes('dark')))
    ) {
        mode = 'dark';
    }
    if (
        (themeMode === 'dark' && (subgroupName === 'inverse' || subgroupName.includes('light'))) ||
        (themeMode === 'light' && (subgroupName === 'default' || subgroupName.includes('light')))
    ) {
        mode = 'light';
    }

    const restoredValue = getRestoredColorFromPalette(value);
    const getDefaultStateToken = getStateColor(restoredValue, sectionName, mode);
    const activeValue = getDefaultStateToken('active');
    const hoverValue = getDefaultStateToken('hover');

    return [activeValue, hoverValue] as const;
};
