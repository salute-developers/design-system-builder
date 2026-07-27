import type { ThemeMode, ThemeToken } from '../types.ts';

const getOppositeValue = (mode: ThemeMode, category: string, subcategory: string, name: string) => {
    const [darkSubcategory, lightSubcategory] = category === 'background' ? ['dark', 'light'] : ['on-dark', 'on-light'];

    if ((mode === 'dark' && subcategory === 'default') || (mode === 'light' && subcategory === 'inverse')) {
        return ['-', darkSubcategory, category, name].join('-');
    }

    if ((mode === 'dark' && subcategory === 'inverse') || (mode === 'light' && subcategory === 'default')) {
        return ['-', lightSubcategory, category, name].join('-');
    }

    return '';
};

const createModeTokens = (tokens: ThemeToken[], mode: ThemeMode) =>
    tokens
        .filter((token) => token.tags[0] === mode)
        .map((token) => {
            const [, category, subcategory, name] = token.name.split('.');

            if (['dark', 'on-dark', 'light', 'on-light'].includes(subcategory)) {
                return undefined;
            }

            const tokenName = [subcategory === 'default' ? '-' : `--${subcategory}`, category, name].join('-');
            const tokenValue = getOppositeValue(mode, category, subcategory, name);
            return `        ${tokenName}: var(${tokenValue});`;
        })
        .filter(Boolean)
        .join('\n');

export function createViewContainerTokens(colorTokens: ThemeToken[] = [], gradientTokens: ThemeToken[] = []) {
    if (!colorTokens.length) {
        return '';
    }

    const tokens = [...colorTokens, ...gradientTokens];
    return `\nexport const viewContainer = {
      dark: \`
${createModeTokens(tokens, 'dark')}
      \`,
      light: \`
${createModeTokens(tokens, 'light')}
      \`,
    };\n`;
}
