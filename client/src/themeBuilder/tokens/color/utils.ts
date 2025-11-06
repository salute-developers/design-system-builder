import { getRestoredColorFromPalette, type ThemeMode } from '@salutejs/plasma-tokens-utils';

import { getStateColor } from '../../../_new/utils';
import { sectionToFormulaMap } from '../../../_new/types';

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

    const restoredValue = getRestoredColorFromPalette(value, -1);
    const getDefaultStateToken = getStateColor(restoredValue, sectionName, mode);

    return {
        [`${name}-hover`]: getDefaultStateToken('hover'),
        [`${name}-active`]: getDefaultStateToken('active'),
        [`${name}-brightness`]: getDefaultStateToken('brightness'),
    };
};
