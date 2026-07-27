import type { ModeTokens, ThemeMode, ThemeToken, ThemeVariations } from '../types.ts';
import { kebabToCamel } from '../utils.ts';

export function createGradientTokens(
    gradient: ThemeVariations['gradient'],
    tokens: ThemeToken[] = [],
    isJavaScript = false,
): ModeTokens<string> {
    const createModeTokens = (mode: ThemeMode) =>
        tokens
            .filter((token) => token.tags[0] === mode)
            .map((token) => {
                const [, category, subcategory, name] = token.name.split('.');
                const tokenName = [subcategory === 'default' ? '-' : `--${subcategory}`, category, name].join('-');
                const value = gradient[token.name];

                if (!isJavaScript) {
                    return value ? `  ${tokenName}: ${String(value)};` : '';
                }

                const variableName = kebabToCamel(tokenName.replace('-', ''));
                const variable = value ? `var(${tokenName}, ${String(value)})` : `var(${tokenName})`;
                return `/** ${token.description} */\nexport const ${variableName} = '${variable}';\n`;
            })
            .join('\n');

    return {
        dark: createModeTokens('dark'),
        light: createModeTokens('light'),
    };
}

export function createShadowTokens(
    shadow: ThemeVariations['shadow'],
    tokens: ThemeToken[] = [],
    isJavaScript = false,
): ModeTokens<string> {
    const createDirectionTokens = (direction: 'down' | 'up') =>
        tokens
            .filter((token) => token.tags[0] === direction)
            .map((token) => {
                const tokenName = token.name.split('.').join('-');
                const value = shadow[token.name];

                if (!isJavaScript) {
                    return value ? `  --shadow-${tokenName}: ${value.join(', ')};` : '';
                }

                const variableName = kebabToCamel(`shadow-${tokenName}`);
                const variable = value ? `var(--shadow-${tokenName}, ${String(value)})` : `var(--shadow-${tokenName})`;
                return `/** ${token.description} */\nexport const ${variableName} = '${variable}';\n`;
            })
            .join('\n');

    const content = `${createDirectionTokens('down')}\n${createDirectionTokens('up')}`;
    return { dark: content, light: content };
}

export function createShapeTokens(
    shape: ThemeVariations['shape'],
    tokens: ThemeToken[] = [],
    isJavaScript = false,
): ModeTokens<string> {
    const content = tokens
        .filter((token) => token.tags[0] === 'round')
        .map((token) => {
            const [, size] = token.name.split('.');
            const value = shape[token.name];

            if (!isJavaScript) {
                return value ? `  --border-radius-${size}: ${value};` : '';
            }

            const variableName = kebabToCamel(`border-radius-${size}`);
            const variable = value ? `var(--border-radius-${size}, ${value})` : `var(--border-radius-${size})`;
            return `/** ${token.description} */\nexport const ${variableName} = '${variable}';\n`;
        })
        .join('\n');

    return { dark: content, light: content };
}

export function createSpacingTokens(
    spacing: ThemeVariations['spacing'],
    tokens: ThemeToken[] = [],
    isJavaScript = false,
): ModeTokens<string> {
    const content = tokens
        .filter((token) => token.tags[0] === 'spacing')
        .map((token) => {
            const [, size] = token.name.split('.');
            const value = spacing[token.name];

            if (!isJavaScript) {
                return value ? `  --spacing-${size}: ${value};` : '';
            }

            const variableName = kebabToCamel(`spacing-${size}`);
            const variable = value ? `var(--spacing-${size}, ${value})` : `var(--spacing-${size})`;
            return `/** ${token.description} */\nexport const ${variableName} = '${variable}';\n`;
        })
        .join('\n');

    return { dark: content, light: content };
}
