import type { ModeTokens, Palette, ThemeMode, ThemeToken, ThemeVariations } from '../types.ts';
import { kebabToCamel, restorePaletteColor } from '../utils.ts';

const BASE_COLOR = `  color: var(--text-primary);
  background-color: var(--background-primary);`;

const createJavaScriptToken = (tokenName: string, token: ThemeToken, value?: string) => {
    const variableName = kebabToCamel(tokenName.replace('-', ''));
    const variable = value ? `var(${tokenName}, ${value})` : `var(${tokenName})`;

    return `/** ${token.description} */\nexport const ${variableName} = '${variable}';\n`;
};

export function createColorTokens(
    color: ThemeVariations['color'],
    palette: Palette,
    tokens: ThemeToken[] = [],
    isJavaScript = false,
): ModeTokens<string> {
    const createModeTokens = (mode: ThemeMode) =>
        tokens
            .filter((token) => token.tags[0] === mode)
            .map((token) => {
                const [, category, subcategory, name] = token.name.split('.');
                const tokenName = [subcategory === 'default' ? '-' : `--${subcategory}`, category, name].join('-');
                const value = color[token.name];
                const restoredValue = value ? restorePaletteColor(value, palette) : undefined;

                return isJavaScript
                    ? createJavaScriptToken(tokenName, token, restoredValue)
                    : restoredValue
                      ? `  ${tokenName}: ${restoredValue};`
                      : '';
            })
            .join('\n');

    return {
        dark: `${createModeTokens('dark')}${isJavaScript ? '' : `\n${BASE_COLOR}`}`,
        light: `${createModeTokens('light')}${isJavaScript ? '' : `\n${BASE_COLOR}`}`,
    };
}
