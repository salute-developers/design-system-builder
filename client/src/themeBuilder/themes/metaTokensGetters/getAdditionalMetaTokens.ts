import { sectionToFormulaMap } from '../../../_new/utils';
import type { TokenType } from '../../types';

export const getAdditionalMetaTokens = (data: TokenType) => {
    const [mode, category, subcategory, name] = data.name.split('.');

    if (!sectionToFormulaMap[category]) {
        return [];
    }

    const hover = [mode, category, subcategory, `${name}-hover`];
    const active = [mode, category, subcategory, `${name}-active`];
    const brightness = [mode, category, subcategory, `${name}-brightness`];

    return [
        {
            ...data,
            name: hover.join('.'),
            tags: hover,
            displayName: `${data.displayName}Hover`,
        },
        {
            ...data,
            name: active.join('.'),
            tags: active,
            displayName: `${data.displayName}Active`,
        },
        {
            ...data,
            name: brightness.join('.'),
            tags: brightness,
            displayName: `${data.displayName}Brightness`,
        },
    ];
};
