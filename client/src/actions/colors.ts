import { getRestoredColorFromPalette, ThemeMode } from '@salutejs/plasma-tokens-utils';

import {
    AndroidColor,
    ColorToken,
    DesignSystem,
    GradientToken,
    IOSColor,
    Theme,
    Token,
    WebColor,
} from '../controllers';
import {
    camelToKebab,
    getColorAndOpacity,
    getNormalizedColor,
    getStateColor,
    kebabToCamel,
    updateTokenChange,
} from '../utils';
import { sectionToFormulaMap } from '../types';

const getAdditionalColorValues = (value: string, themeMode: string, groupName: string, subgroupName: string) => {
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

    const restoredValue = getRestoredColorFromPalette(value);
    const getDefaultStateToken = getStateColor(restoredValue, sectionName, mode);
    const activeValue = getDefaultStateToken('active');
    const hoverValue = getDefaultStateToken('hover');

    return [activeValue, hoverValue] as const;
};

interface AddTokenProps {
    groupName: string;
    tokenName: string;
    tabName?: string;
    tokens?: (Token | unknown)[];
    theme?: Theme;
    designSystem?: DesignSystem;
}

interface DisableTokenProps {
    disabled: boolean;
    tokens?: (Token | unknown)[];
    designSystem?: DesignSystem;
}

interface UpdateTokenProps {
    color: string;
    opacity: number;
    token?: ColorToken | GradientToken;
    theme?: Theme;
    designSystem?: DesignSystem;
}

interface ResetTokenProps {
    token?: ColorToken | GradientToken;
    theme?: Theme;
    designSystem?: DesignSystem;
}

interface ColorTokenActions {
    addToken: (props: AddTokenProps) => void;
    disableToken: (props: DisableTokenProps) => void;
    updateToken: (props: UpdateTokenProps) => void;
    resetToken: (props: ResetTokenProps) => {
        color: string;
        opacity: number;
        description: string | undefined;
    };
}

export const colorTokenActions: ColorTokenActions = {
    addToken: async ({ groupName, tokenName, tabName, tokens, theme }) => {
        if (!theme || !tabName || !tokens) {
            return;
        }

        // TODO: Очень не нравится это
        const normalizedTabName = groupName === 'Background' ? tabName.replace('On', '') : tabName;
        const rest = [camelToKebab(groupName), camelToKebab(normalizedTabName), camelToKebab(tokenName)];

        const isTokenExist = theme.getToken(['dark', ...rest].join('.'), 'color');

        if (isTokenExist) {
            console.warn('Токен уже существует');
            return;
        }

        const createMeta = (mode: string, postfix?: string) => {
            const parts = [...rest];

            if (postfix) {
                const last = parts.pop();
                parts.push(last + postfix);
            }

            return {
                tags: [mode, ...parts],
                name: [mode, ...parts].join('.'),
                displayName: kebabToCamel(`${camelToKebab(groupName)}-${camelToKebab(tokenName)}`),
                description: 'New description',
                enabled: true,
            };
        };

        const defaultValue = '[general.gray.50]';

        tokens.forEach((token) => {
            const [themeMode, groupName, subgroupName, ..._] = (token as Token).getTags();
            const newToken = new ColorToken(createMeta(themeMode), {
                web: new WebColor(defaultValue),
                ios: new IOSColor(defaultValue),
                android: new AndroidColor(defaultValue),
            });

            // TODO: Подумать о том, надо ли добавлять в черновики новые токены
            theme.addToken('color', newToken);

            const additionalValues = getAdditionalColorValues(defaultValue, themeMode, groupName, subgroupName);

            if (!additionalValues) {
                return;
            }

            const [activeValue, hoverValue] = additionalValues;

            const activeToken = new ColorToken(createMeta(themeMode, '-active'), {
                web: new WebColor(activeValue),
                ios: new IOSColor(activeValue),
                android: new AndroidColor(activeValue),
            });
            const hoverToken = new ColorToken(createMeta(themeMode, '-hover'), {
                web: new WebColor(hoverValue),
                ios: new IOSColor(hoverValue),
                android: new AndroidColor(hoverValue),
            });

            theme.addToken('color', activeToken);
            theme.addToken('color', hoverToken);
        });

        // const readTheme = await readThemeBuildInstanceAndWrite('sdds_platform_ai');
        // const themeData = {
        //     meta: createMetaTokens(readTheme),
        //     variations: createVariationTokens(readTheme),
        // };
        // const parameters = {
        //     projectName: 'SDDS PLATFORM AI',
        //     packagesName: 'sdds_platform_ai',
        //     grayTone: 'gray',
        //     accentColor: 'blue',
        //     lightStrokeSaturation: 50,
        //     lightFillSaturation: 50,
        //     darkStrokeSaturation: 50,
        //     darkFillSaturation: 50,
        // } as Partial<Parameters>;
        // await DesignSystem.create({
        //     name: 'sdds_platform_ai',
        //     version: '0.1.0',
        //     parameters,
        //     themeData,
        // });
    },
    disableToken: ({ disabled, tokens, designSystem }: DisableTokenProps) => {
        const dsName = designSystem?.getName() || '';
        const dsVersion = designSystem?.getVersion() || '';

        (tokens as Token[]).forEach((token) => {
            // TODO: Подумать про то, надо ли отключать / включать hover и active токены
            token.setEnabled(disabled);
            updateTokenChange(dsName, dsVersion, token, 'toggle');
        });
    },
    updateToken: ({ color, opacity, token, theme, designSystem }: UpdateTokenProps) => {
        // TODO: Пока только для сплошных цветов
        if (!token || !designSystem || !theme || !(token instanceof ColorToken)) {
            return;
        }

        const dsName = designSystem.getName() || '';
        const dsVersion = designSystem.getVersion() || '';

        const platforms = Object.keys(token.getPlatforms());

        const newValue = color.startsWith('general.')
            ? `[${color}]${opacity === 1 ? '' : `[${opacity}]`}`
            : getNormalizedColor(color, opacity);

        for (const platform of platforms) {
            token.setValue(platform, newValue);
        }

        updateTokenChange(dsName, dsVersion, token, 'save');

        const [themeMode, groupName, subgroupName, ..._] = token.getTags();
        const additionalValues = getAdditionalColorValues(newValue, themeMode, groupName, subgroupName);

        if (!additionalValues) {
            return;
        }

        const activeToken = theme.getToken(`${token.getName()}-active`, 'color');
        const hoverToken = theme.getToken(`${token.getName()}-hover`, 'color');

        const [activeValue, hoverValue] = additionalValues;

        if (!activeToken || !hoverToken) {
            return;
        }

        for (const platform of platforms) {
            activeToken.setValue(platform, activeValue);
            hoverToken.setValue(platform, hoverValue);
        }

        updateTokenChange(dsName, dsVersion, activeToken, 'save');
        updateTokenChange(dsName, dsVersion, hoverToken, 'save');
    },
    resetToken: ({ token, theme, designSystem }: ResetTokenProps) => {
        if (!token || !designSystem || !theme) {
            return {
                color: '#FFFFFF',
                opacity: 1,
                description: 'Description',
            };
        }

        const dsName = designSystem.getName() || '';
        const dsVersion = designSystem.getVersion() || '';

        const defaultDescription = token.getDefaultDescription();
        const platforms = Object.keys(token.getPlatforms());
        const activeToken = theme.getToken(`${token.getName()}-active`, 'color');
        const hoverToken = theme.getToken(`${token.getName()}-hover`, 'color');

        for (const platform of platforms) {
            token.setValue(platform, token.getDefaultValue(platform));
            token.setDescription(defaultDescription);

            if (!activeToken || !hoverToken) {
                continue;
            }

            activeToken.setValue(platform, activeToken.getDefaultValue(platform));
            hoverToken.setValue(platform, hoverToken.getDefaultValue(platform));
        }

        const [colorValue, opacityValue] = getColorAndOpacity(token.getDefaultValue('web'));

        updateTokenChange(dsName, dsVersion, token, 'remove');
        updateTokenChange(dsName, dsVersion, activeToken, 'remove');
        updateTokenChange(dsName, dsVersion, hoverToken, 'remove');

        return {
            color: colorValue,
            opacity: opacityValue,
            description: defaultDescription,
        };
    },
};
