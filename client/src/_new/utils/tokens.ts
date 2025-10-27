import { getRestoredColorFromPalette } from '@salutejs/plasma-tokens-utils';

import {
    ColorToken,
    GradientToken,
    ShadowToken,
    ShapeToken,
    SpacingToken,
    Theme,
    TypographyToken,
} from '../../themeBuilder';
import { capitalize, kebabToCamel } from './';
import { Data, TokenType } from '../types';
import { Token } from '../../themeBuilder/tokens/token';

export type DataTokens = Record<
    string,
    Record<
        string,
        Record<
            string,
            Record<
                string,
                {
                    enabled: boolean;
                    value: any;
                    token: Token;
                }
            >
        >
    >
>;

const generateColorTokensMap = (colors: ColorToken[], gradients: GradientToken[]) => {
    const data: DataTokens = {};

    const addToData = (tokens: ColorToken[] | GradientToken[]) => {
        tokens.forEach((token) => {
            const [mode, group, subgroup] = token.getTags();
            const name = token.getDisplayName();
            const tab = subgroup === 'light' ? 'onLight' : subgroup === 'dark' ? 'onDark' : kebabToCamel(subgroup);

            const enabled = token.getEnabled();
            let value = '';
            if (token instanceof ColorToken) {
                value = getRestoredColorFromPalette(token.getValue('web') as string, -1);
            }
            if (token instanceof GradientToken) {
                value = token.getValue('web').join(' ');
            }

            if (!data[tab]) {
                data[tab] = {};
            }

            if (!data[tab][group]) {
                data[tab][group] = {};
            }

            if (!data[tab][group][name]) {
                data[tab][group][name] = {};
            }

            data[tab][group][name][mode] = {
                enabled,
                value,
                token,
            };
        });
    };

    addToData(colors);
    addToData(gradients);

    return data;
};

const generateTypographyTokensMap = (typography: TypographyToken[]) => {
    const data: DataTokens = {};

    const addToData = (tokens: TypographyToken[]) => {
        tokens.forEach((token) => {
            const [mode, group] = token.getTags();
            const tab = 'default';
            const name = token.getDisplayName();

            const enabled = token.getEnabled();
            const value = `${parseInt(token.getValue('web').fontSize) * 16}/${
                parseInt(token.getValue('web').lineHeight) * 16
            }`;

            if (!data[tab]) {
                data[tab] = {};
            }

            if (!data[tab][group]) {
                data[tab][group] = {};
            }

            if (!data[tab][group][name]) {
                data[tab][group][name] = {};
            }

            data[tab][group][name][mode] = {
                enabled,
                value,
                token,
            };
        });
    };

    addToData(typography);

    return data;
};

const generateShapeTokensMap = (shapes: ShapeToken[], shadows: ShadowToken[], spacings: SpacingToken[]) => {
    const data: DataTokens = {};

    const addToData = (tokens: ShapeToken[] | ShadowToken[] | SpacingToken[], group: string) => {
        tokens.forEach((token) => {
            const tab = 'default';
            const mode = 'default';
            const name = token.getDisplayName();

            const enabled = token.getEnabled();
            let value = '';
            if (token instanceof SpacingToken) {
                value = token.getValue('web');
            }
            if (token instanceof ShapeToken) {
                value = `${parseInt(token.getValue('web')) * 16}px`;
            }

            if (!data[tab]) {
                data[tab] = {};
            }

            if (!data[tab][group]) {
                data[tab][group] = {};
            }

            if (!data[tab][group][name]) {
                data[tab][group][name] = {};
            }

            data[tab][group][name][mode] = {
                enabled,
                value,
                token,
            };
        });
    };

    addToData(shapes, 'shapes');
    addToData(shadows, 'shadows');
    addToData(spacings, 'spacings');

    return data;
};

const createDataTokens = (dataTokens: DataTokens, tokenType: TokenType, tabsName?: string) => {
    const data: Data = {
        groups: [],
    };

    if (tabsName) {
        data.tabs = {
            name: tabsName,
            values: Object.keys(dataTokens).map(capitalize),
        };
    }

    Object.entries(dataTokens).forEach(([tab, groups]) => {
        data.groups.push({
            value: tabsName ? capitalize(tab) : undefined,
            data: Object.entries(groups).map(([group, tokens]) => ({
                name: capitalize(group),
                type: tokenType,
                tokens: Object.entries(tokens).map(([name, modes]) => {
                    const disabled = !Object.values(modes)[0].enabled;
                    const previewValues = Object.values(modes).map(({ value }) => value);
                    const data = Object.values(modes).map(({ token }) => token);

                    return {
                        name,
                        disabled,
                        previewValues,
                        data,
                    };
                }),
            })),
        });
    });

    return data;
};

export const getDataTokens = (theme?: Theme, type?: TokenType): Data | undefined => {
    if (!theme) {
        return undefined;
    }

    if (type === 'color') {
        const colors = theme.getTokens('color');
        const gradients = theme.getTokens('gradient');
        const colorTokens = generateColorTokensMap(colors, gradients);

        return createDataTokens(colorTokens, 'color', 'Подтемы');
    }

    if (type === 'typography') {
        const typography = theme.getTokens('typography');
        const typographyTokens = generateTypographyTokensMap(typography);

        return createDataTokens(typographyTokens, 'typography');
    }

    if (type === 'shape') {
        const shapes = theme.getTokens('shape');
        const shadows = theme.getTokens('shadow');
        const spacings = theme.getTokens('spacing');
        const shapeTokens = generateShapeTokensMap(shapes, shadows, spacings);

        return createDataTokens(shapeTokens, 'shape');
    }

    return {} as Data;
};
