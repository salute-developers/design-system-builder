import { AndroidGradient, DesignSystem, GradientToken, Theme, WebGradient, IOSGradient, Token } from '../controllers';
import { camelToKebab, kebabToCamel, createDraftToken, updateDraftToken } from '../utils';
import { parseGradient } from '../utils/gradient';

// const getAdditionalColorValues = (value: string, themeMode: string, groupName: string, subgroupName: string) => {
//     const sectionName = sectionToFormulaMap[groupName.toLocaleLowerCase()];

//     if (!sectionName) {
//         return undefined;
//     }

//     let mode = themeMode as ThemeMode;

//     if (
//         (themeMode === 'dark' && (subgroupName === 'default' || subgroupName.includes('dark'))) ||
//         (themeMode === 'light' && (subgroupName === 'inverse' || subgroupName.includes('dark')))
//     ) {
//         mode = 'dark';
//     }
//     if (
//         (themeMode === 'dark' && (subgroupName === 'inverse' || subgroupName.includes('light'))) ||
//         (themeMode === 'light' && (subgroupName === 'default' || subgroupName.includes('light')))
//     ) {
//         mode = 'light';
//     }

//     const restoredValue = getRestoredColorFromPalette(value);
//     const getDefaultStateToken = getStateColor(restoredValue, sectionName, mode);
//     const activeValue = getDefaultStateToken('active');
//     const hoverValue = getDefaultStateToken('hover');

//     return [activeValue, hoverValue] as const;
// };

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
    gradient: string[];
    token?: GradientToken;
    theme?: Theme;
    designSystem?: DesignSystem;
}

interface ResetTokenProps {
    token?: GradientToken;
    theme?: Theme;
    designSystem?: DesignSystem;
}

interface GradientTokenActions {
    addToken: (props: AddTokenProps) => void;
    disableToken: (props: DisableTokenProps) => void;
    updateToken: (props: UpdateTokenProps) => void;
    resetToken: (props: ResetTokenProps) => {
        color: string;
        opacity: number;
        description: string | undefined;
    };
}

export const gradientTokenActions: GradientTokenActions = {
    addToken: ({ groupName, tokenName, tabName, tokens, theme, designSystem }) => {
        if (!theme || !tabName || !tokens || !designSystem) {
            return;
        }

        // TODO: Убрать, когда сделаем background с OnDark/OnLight
        const normalizedTabName = groupName === 'Background' ? tabName.replace('On', '') : tabName;
        const prefix = normalizedTabName === 'Default' ? '' : `${normalizedTabName}-`;
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
                displayName: kebabToCamel(
                    `${camelToKebab(prefix)}${camelToKebab(groupName)}-${camelToKebab(tokenName)}`,
                ),
                description: 'New description',
                enabled: true,
            };
        };

        const defaultValue = ['#FFFFFFFF'];
        const defaultNativeValue: any = [
            {
                kind: 'linear',
                locations: [0, 1],
                colors: ['#FFFFFF', '#000000'],
                angle: 90,
            },
        ];

        const dsName = designSystem.getName() || '';
        const dsVersion = designSystem.getVersion() || '';

        const themeModes = ['dark', 'light'];

        themeModes.forEach((themeMode) => {
            const newToken = new GradientToken(createMeta(themeMode), {
                web: new WebGradient(defaultValue),
                ios: new IOSGradient(defaultNativeValue),
                android: new AndroidGradient(defaultNativeValue),
            });

            theme.addToken('gradient', newToken);
            createDraftToken(dsName, dsVersion, newToken);

            const additionalValues = [defaultValue, defaultValue];
            const additionalNativeValues = [defaultNativeValue, defaultNativeValue];

            if (!additionalValues) {
                return;
            }

            const [activeValue, hoverValue] = additionalValues;
            const [activeNativeValue, hoverNativeValue] = additionalNativeValues;

            const activeToken = new GradientToken(createMeta(themeMode, '-active'), {
                web: new WebGradient(activeValue),
                ios: new IOSGradient(activeNativeValue),
                android: new AndroidGradient(activeNativeValue),
            });
            const hoverToken = new GradientToken(createMeta(themeMode, '-hover'), {
                web: new WebGradient(hoverValue),
                ios: new IOSGradient(hoverNativeValue),
                android: new AndroidGradient(hoverNativeValue),
            });

            theme.addToken('gradient', activeToken);
            theme.addToken('gradient', hoverToken);

            createDraftToken(dsName, dsVersion, activeToken);
            createDraftToken(dsName, dsVersion, hoverToken);
        });
    },
    disableToken: ({ disabled, tokens, designSystem }: DisableTokenProps) => {
        const dsName = designSystem?.getName() || '';
        const dsVersion = designSystem?.getVersion() || '';

        (tokens as Token[]).forEach((token) => {
            // TODO: Подумать про то, надо ли отключать / включать hover и active токены
            token.setEnabled(disabled);
            updateDraftToken(dsName, dsVersion, token, 'toggle');
        });
    },
    updateToken: ({ gradient, token, theme, designSystem }: UpdateTokenProps) => {
        if (!token || !designSystem || !theme || !(token instanceof GradientToken)) {
            return;
        }

        const dsName = designSystem.getName() || '';
        const dsVersion = designSystem.getVersion() || '';

        token.setValue('web', gradient);
        token.setValue('ios', parseGradient(gradient, 'ios'));
        token.setValue('android', parseGradient(gradient, 'android'));

        updateDraftToken(dsName, dsVersion, token, 'save');
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
        const activeToken = theme.getToken(`${token.getName()}-active`, 'gradient');
        const hoverToken = theme.getToken(`${token.getName()}-hover`, 'gradient');

        for (const platform of platforms) {
            token.setValue(platform, token.getDefaultValue(platform));
            token.setDescription(defaultDescription);

            if (!activeToken || !hoverToken) {
                continue;
            }

            activeToken.setValue(platform, activeToken.getDefaultValue(platform));
            hoverToken.setValue(platform, hoverToken.getDefaultValue(platform));
        }

        const [gradientValue] = token.getDefaultValue('web');

        updateDraftToken(dsName, dsVersion, token, 'remove');
        updateDraftToken(dsName, dsVersion, activeToken, 'remove');
        updateDraftToken(dsName, dsVersion, hoverToken, 'remove');

        return {
            color: gradientValue,
            opacity: 1,
            description: defaultDescription,
        };
    },
};
