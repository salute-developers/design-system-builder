import { Config } from '../componentBuilder';
import { indentedLine, kebabToCamel, lowerFirstLetter } from '../utils';

const keyFormat = (key: string, componentName: string) => {
    const value = lowerFirstLetter(kebabToCamel(key.replace('--plasma', '')));

    return `$\{${lowerFirstLetter(componentName)}Tokens.${value}}`;
};

const getDefaults = (config: Config): Record<string, string> => {
    return config.getDefaults().reduce(
        (acc, item) => ({
            ...acc,
            [item.getVariation()]: item.getStyle(),
        }),
        {},
    );
};

const getVariations = (config: Config): Record<string, any> => {
    return config.getVariations().reduce((variationsAcc, variation) => {
        const styles = variation.getStyles()?.reduce((stylesAcc, style) => {
            const props = style
                .getProps()
                .getList()
                .reduce((propsAcc, prop) => {
                    const result = prop.getWebTokenValue();

                    return {
                        ...propsAcc,
                        ...result,
                    };
                }, {});

            const styleName = style.getName();

            return {
                ...stylesAcc,
                [styleName]: props,
            };
        }, {});

        const variationName = variation.getName();

        return {
            ...variationsAcc,
            [variationName]: styles,
        };
    }, {});
};

const getInvariants = (config: Config): Record<string, string> => {
    return config
        .getInvariants()
        .getList()
        ?.reduce((propsAcc, prop) => {
            const result = prop.getWebTokenValue();

            return {
                ...propsAcc,
                ...result,
            };
        }, {});
};

const formatDefaults = (defaults: Record<string, any>) => {
    return Object.entries(defaults)
        .map(([key, value]) => indentedLine(`${key}: '${value}',`, 2))
        .join('\n');
};

const formatVariations = (variations: Record<string, any>, componentName: string) => {
    return Object.entries(variations)
        .map(([variationKey, variationValue]) => {
            const formattedContentInner = Object.entries(variationValue)
                .map(([styleKey, styleValue]) => {
                    const cssContent = Object.entries(styleValue as any)
                        .map(([propKey, propValue]) =>
                            indentedLine(`${keyFormat(propKey, componentName)}: ${propValue};`, 4),
                        )
                        .join('\n');

                    const isEmpty = cssContent.trim() === '';

                    // prettier-ignore
                    return isEmpty
                        ? indentedLine(`${styleKey}: css\`\`,`, 3)
                        : [
                            indentedLine(`${styleKey}: css\``, 3), 
                            cssContent, 
                            indentedLine('`,', 3)
                        ].join('\n');
                })
                .join('\n');

            // prettier-ignore
            return [
                indentedLine(`${variationKey}: {`, 2), 
                formattedContentInner, 
                indentedLine('},', 2)
            ].join('\n');
        })
        .join('\n');
};

const formatInvariants = (invariants: Record<string, any>, componentName: string) => {
    return Object.entries(invariants)
        .map(([key, value]) => indentedLine(`${keyFormat(key, componentName)}: ${value};`, 2))
        .join('\n');
};

export const createComponentConfig = (componentName: string, config: Config) => {
    const defaults = getDefaults(config);
    const variations = getVariations(config);
    const invariants = getInvariants(config);

    const configContent = [
        indentedLine('defaults: {', 1),
        formatDefaults(defaults),
        indentedLine('},', 1),
        indentedLine('variations: {', 1),
        formatVariations(variations, componentName),
        indentedLine('},', 1),
        indentedLine('invariants: css`', 1),
        formatInvariants(invariants, componentName),
        indentedLine('`', 1),
    ].join('\n');

    return `import { css, ${lowerFirstLetter(componentName)}Tokens } from '@salutejs/plasma-new-hope/styled-components';

export const config = {
${configContent},
};
`;
};
