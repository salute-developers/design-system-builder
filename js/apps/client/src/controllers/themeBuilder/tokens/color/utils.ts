import { type ThemeMode } from '@salutejs/plasma-tokens-utils';

import { getStateColor } from '../../../../utils';
import { sectionToFormulaMap } from '../../../../types';
import { restorePaletteColor } from '../../../../palette/activePalette';

export const getTokensNames = (name: string) => {
    // TODO: подумать, может есть решение лучше
    const [darkSubGroup, lightSubGroup] =
        name.split('.')[1] === 'background' ? ['dark', 'light'] : ['on-dark', 'on-light'];

    const onDarkName = name.replace('default', darkSubGroup);
    const onLightName = name.replace('default', lightSubGroup);
    const inverseName = name.replace('default', 'inverse');

    return [onDarkName, onLightName, inverseName];
};

export const getAdditionalColorThemeTokens = (name: string, value: string, mode: ThemeMode) => {
    const [, category] = name.split('.');
    const sectionName = sectionToFormulaMap[category];

    if (!sectionName) {
        return undefined;
    }

    const restoredValue = restorePaletteColor(value, -1, name);
    const getDefaultStateToken = getStateColor(restoredValue, sectionName, mode);

    return {
        [`${name}-hover`]: getDefaultStateToken('hover'),
        [`${name}-active`]: getDefaultStateToken('active'),
        [`${name}-brightness`]: getDefaultStateToken('brightness'),
    };
};
