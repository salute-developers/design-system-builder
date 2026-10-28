import { ThemeMode } from '@salutejs/plasma-tokens-utils';

import { sectionToFormulaMap } from '../types';
import { getStateColor } from '../utils';
import { restorePaletteColor } from '../palette/activePalette';

/** Значения состояний `-active` и `-hover` для значения токена — `undefined`, если группа их не пересчитывает. */
export const getAdditionalColorValues = (
    value: string,
    themeMode: string,
    groupName: string,
    subgroupName: string,
    tokenName?: string,
) => {
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

    const restoredValue = restorePaletteColor(value, -1, tokenName);
    const getDefaultStateToken = getStateColor(restoredValue, sectionName, mode);
    const activeValue = getDefaultStateToken('active');
    const hoverValue = getDefaultStateToken('hover');

    return [activeValue, hoverValue] as const;
};
