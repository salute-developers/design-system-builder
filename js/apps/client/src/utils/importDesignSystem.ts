import { createMetaTokens, createVariationTokens } from '../controllers';

import { readThemeBuildInstanceAndWrite } from '../controllers/themeBuilder/examples/readThemeBuildInstanceAndWrite';

import { Parameters } from '../types';

const transformDisplayName = (displayName: string): string => {
    const typoMatch = displayName.match(/^screen[SLMX](Display|Header|Body|Text)([A-Za-z0-9]+?)(Bold|Medium)?$/);
    if (typoMatch) {
        const [, kind, size, weight] = typoMatch;
        const weightSuffix = weight === 'Bold' ? 'B' : weight === 'Medium' ? 'M' : 'N';

        return `${kind}${size} ${weightSuffix}`;
    }

    const shadowMatch = displayName.match(/^shadow(Down|Up)(Soft|Hard)([SLM])$/);
    if (shadowMatch) {
        const [, direction, softHard, size] = shadowMatch;

        return `${direction.toLowerCase()}${softHard}${size}`;
    }

    return displayName;
};

const loadDesignSystemFromZip = async (content: ArrayBuffer) => {
    const readTheme = await readThemeBuildInstanceAndWrite('', true, content);

    const meta = createMetaTokens(readTheme);
    meta.tokens.forEach((token) => {
        token.displayName = transformDisplayName(token.displayName);
    });

    return {
        meta,
        variations: createVariationTokens(readTheme),
    };
};

export const importDesignSystem = async (content: ArrayBuffer | string) => {
    const themeData = typeof content === 'string' ? JSON.parse(content) : await loadDesignSystemFromZip(content);

    const { name } = themeData.meta;

    const parameters = {
        projectName: name.split('_').join(' ').toUpperCase(),
        packagesName: name,
        grayTone: 'gray',
        accentColor: 'blue',
        lightStrokeSaturation: 50,
        lightFillSaturation: 50,
        darkStrokeSaturation: 50,
        darkFillSaturation: 50,
    } as Partial<Parameters>;

    return { name, parameters, themeData };
};
