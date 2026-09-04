import { getRestoredColorFromPalette, ThemeMode } from '@salutejs/plasma-tokens-utils';

import { AndroidColor, ColorToken, DesignSystem, IOSColor, Theme, Token, WebColor } from '../controllers';
import { sectionToFormulaMap } from '../types';
import {
    camelToKebab,
    getColorAndOpacity,
    getNormalizedColor,
    getStateColor,
    kebabToCamel,
    createDraftToken,
    updateDraftToken,
    renameDraftToken,
    isDraftAddedToken,
} from '../utils';

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

    const restoredValue = getRestoredColorFromPalette(value, -1);
    const getDefaultStateToken = getStateColor(restoredValue, sectionName, mode);
    const activeValue = getDefaultStateToken('active');
    const hoverValue = getDefaultStateToken('hover');

    return [activeValue, hoverValue] as const;
};

interface AddTokenProps {
    groupName: string;
    tokenName: string;
    theme?: Theme;
    designSystem?: DesignSystem;
}

interface DisableTokenProps {
    disabled: boolean;
    tokens?: (Token | unknown)[];
    theme?: Theme;
    designSystem?: DesignSystem;
}

interface UpdateTokenProps {
    color: string;
    opacity: number;
    token?: ColorToken;
    theme?: Theme;
    designSystem?: DesignSystem;
}

interface RenameTokenGroupProps {
    defaultToken?: ColorToken;
    newDisplayName: string;
    theme?: Theme;
    designSystem?: DesignSystem;
}

interface DeleteTokenGroupProps {
    defaultToken?: ColorToken;
    theme?: Theme;
    designSystem?: DesignSystem;
}

interface ResetTokenGroupProps {
    defaultToken?: ColorToken;
    theme?: Theme;
    designSystem?: DesignSystem;
}

interface ColorTokenActions {
    addToken: (props: AddTokenProps) => void;
    disableToken: (props: DisableTokenProps) => void;
    updateToken: (props: UpdateTokenProps) => void;
    renameTokenGroup: (props: RenameTokenGroupProps) => void;
    deleteTokenGroup: (props: DeleteTokenGroupProps) => void;
    resetTokenGroup: (props: ResetTokenGroupProps) => {
        color: string;
        opacity: number;
        description: string | undefined;
    };
}

export const colorTokenActions: ColorTokenActions = {
    addToken: ({ groupName, tokenName, theme, designSystem }) => {
        if (!theme || !designSystem || !groupName || !tokenName) {
            return;
        }

        const groupKebab = camelToKebab(groupName);
        const tokenKebab = camelToKebab(tokenName);

        const subgroups: Array<{ subgroupKebab: string; displayPrefix: string }> = [
            { subgroupKebab: 'default', displayPrefix: '' },
            { subgroupKebab: 'inverse', displayPrefix: 'inverse-' },
            { subgroupKebab: 'on-dark', displayPrefix: 'on-dark-' },
            { subgroupKebab: 'on-light', displayPrefix: 'on-light-' },
        ];

        const isTokenExist = theme.getToken(`dark.${groupKebab}.default.${tokenKebab}`, 'color');
        if (isTokenExist) {
            console.warn('Токен уже существует');
            return;
        }

        const createMeta = (mode: string, subgroupKebab: string, displayPrefix: string, postfix?: string) => {
            const parts = [groupKebab, subgroupKebab, tokenKebab];

            if (postfix) {
                const last = parts.pop();
                parts.push(last + postfix);
            }

            return {
                tags: [mode, ...parts],
                name: [mode, ...parts].join('.'),
                displayName: kebabToCamel(`${displayPrefix}${groupKebab}-${tokenKebab}${postfix ?? ''}`),
                description: 'New description',
                enabled: true,
            };
        };

        const defaultValue = '[general.gray.50]';

        const dsName = designSystem.getName() || '';
        const dsVersion = designSystem.getVersion() || '';

        const themeModes = ['dark', 'light'];

        themeModes.forEach((themeMode) => {
            subgroups.forEach(({ subgroupKebab, displayPrefix }) => {
                const newToken = new ColorToken(createMeta(themeMode, subgroupKebab, displayPrefix), {
                    web: new WebColor(defaultValue),
                    ios: new IOSColor(defaultValue),
                    android: new AndroidColor(defaultValue),
                });

                theme.addToken('color', newToken);
                createDraftToken(dsName, dsVersion, newToken);

                const additionalValues = getAdditionalColorValues(defaultValue, themeMode, groupName, subgroupKebab);

                if (!additionalValues) {
                    return;
                }

                const [activeValue, hoverValue] = additionalValues;

                const activeToken = new ColorToken(createMeta(themeMode, subgroupKebab, displayPrefix, '-active'), {
                    web: new WebColor(activeValue),
                    ios: new IOSColor(activeValue),
                    android: new AndroidColor(activeValue),
                });
                const hoverToken = new ColorToken(createMeta(themeMode, subgroupKebab, displayPrefix, '-hover'), {
                    web: new WebColor(hoverValue),
                    ios: new IOSColor(hoverValue),
                    android: new AndroidColor(hoverValue),
                });

                theme.addToken('color', activeToken);
                theme.addToken('color', hoverToken);

                createDraftToken(dsName, dsVersion, activeToken);
                createDraftToken(dsName, dsVersion, hoverToken);
            });
        });
    },
    disableToken: ({ disabled, tokens, theme, designSystem }: DisableTokenProps) => {
        const dsName = designSystem?.getName() || '';
        const dsVersion = designSystem?.getVersion() || '';

        (tokens as Token[]).forEach((token) => {
            token.setEnabled(disabled);
            updateDraftToken(dsName, dsVersion, token, 'toggle');

            if (!theme) {
                return;
            }

            const stateTokens = [
                theme.getToken(`${token.getName()}-hover`, 'color'),
                theme.getToken(`${token.getName()}-active`, 'color'),
            ];

            stateTokens.forEach((stateToken) => {
                if (!stateToken || stateToken.getEnabled() === disabled) {
                    return;
                }

                stateToken.setEnabled(disabled);
                updateDraftToken(dsName, dsVersion, stateToken, 'toggle');
            });
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

        updateDraftToken(dsName, dsVersion, token, 'save');

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

        updateDraftToken(dsName, dsVersion, activeToken, 'save');
        updateDraftToken(dsName, dsVersion, hoverToken, 'save');
    },
    renameTokenGroup: ({ defaultToken, newDisplayName, theme, designSystem }) => {
        if (!defaultToken || !theme || !designSystem || !newDisplayName) {
            return;
        }

        const dsName = designSystem.getName() || '';
        const dsVersion = designSystem.getVersion() || '';

        const defaultTags = defaultToken.getTags();
        const groupKebab = defaultTags[1];
        const defaultName = defaultToken.getName();
        const defaultNameParts = defaultName.split('.');
        const oldTokenKebab = defaultNameParts[defaultNameParts.length - 1];

        const groupCamel = kebabToCamel(groupKebab);
        const upperFirst = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

        const stripPrefix = (display: string, prefix: string) =>
            display.startsWith(prefix) ? display.slice(prefix.length) : display;

        const remainderCamel = (() => {
            const withoutGroup = stripPrefix(newDisplayName, groupCamel);

            if (withoutGroup === newDisplayName) {
                return newDisplayName;
            }

            return withoutGroup.charAt(0).toLowerCase() + withoutGroup.slice(1);
        })();
        const newTokenKebab = camelToKebab(remainderCamel);

        if (newTokenKebab === oldTokenKebab) {
            return;
        }

        const oldTokenCamelUpper = upperFirst(kebabToCamel(oldTokenKebab));
        const newTokenCamelUpper = upperFirst(remainderCamel);

        const postfixes = ['-hover', '-active', '-brightness'];

        const replaceTrailing = (value: string, fromCore: string, toCore: string) => {
            if (value.endsWith(fromCore)) {
                return value.slice(0, -fromCore.length) + toCore;
            }

            for (const postfix of postfixes) {
                const postfixCamel = upperFirst(kebabToCamel(postfix.slice(1)));
                const fromWithPostfix = fromCore + postfixCamel;

                if (value.endsWith(fromWithPostfix)) {
                    return value.slice(0, -fromWithPostfix.length) + toCore + postfixCamel;
                }
            }

            return value;
        };

        const replaceNameLastPart = (name: string) => {
            const parts = name.split('.');
            const last = parts[parts.length - 1];
            const newLast = (() => {
                if (last === oldTokenKebab) {
                    return newTokenKebab;
                }

                for (const postfix of postfixes) {
                    if (last === oldTokenKebab + postfix) {
                        return newTokenKebab + postfix;
                    }
                }

                return last;
            })();

            if (newLast === last) {
                return null;
            }

            parts[parts.length - 1] = newLast;

            return parts.join('.');
        };

        const allColorTokens = theme.getTokens('color');

        allColorTokens.forEach((targetToken) => {
            const tags = targetToken.getTags();
            if (tags[1] !== groupKebab) {
                return;
            }

            const oldName = targetToken.getName();
            const newName = replaceNameLastPart(oldName);
            if (!newName) {
                return;
            }

            const newTokenDisplayName = replaceTrailing(
                targetToken.getDisplayName(),
                oldTokenCamelUpper,
                newTokenCamelUpper,
            );

            const newTags = [...tags];
            const lastTag = newTags[newTags.length - 1];

            if (lastTag === oldTokenKebab) {
                newTags[newTags.length - 1] = newTokenKebab;
            } else {
                for (const postfix of postfixes) {
                    if (lastTag === oldTokenKebab + postfix) {
                        newTags[newTags.length - 1] = newTokenKebab + postfix;
                        break;
                    }
                }
            }

            targetToken.setName(newName);
            targetToken.setDisplayName(newTokenDisplayName);
            targetToken.setTags(newTags);

            renameDraftToken(dsName, dsVersion, oldName, targetToken);
        });
    },
    deleteTokenGroup: ({ defaultToken, theme, designSystem }) => {
        if (!defaultToken || !theme || !designSystem) {
            return;
        }

        const dsName = designSystem.getName() || '';
        const dsVersion = designSystem.getVersion() || '';

        const defaultTags = defaultToken.getTags();
        const groupKebab = defaultTags[1];
        const defaultNameParts = defaultToken.getName().split('.');
        const tokenKebab = defaultNameParts[defaultNameParts.length - 1];

        const postfixes = ['', '-hover', '-active', '-brightness'];

        const matchesToRemove = theme
            .getTokens('color')
            .filter((t) => {
                if (t.getTags()[1] !== groupKebab) {
                    return false;
                }
                const last = t.getName().split('.').slice(-1)[0];

                return postfixes.some((p) => last === tokenKebab + p);
            })
            .map((t) => ({ name: t.getName(), token: t }));

        matchesToRemove.forEach(({ name, token }) => {
            updateDraftToken(dsName, dsVersion, token, 'remove');
            theme.removeToken(name, 'color');
        });
    },
    resetTokenGroup: ({ defaultToken, theme, designSystem }) => {
        const fallback = {
            color: '#FFFFFF',
            opacity: 1,
            description: 'Description' as string | undefined,
        };

        if (!defaultToken || !theme || !designSystem) {
            return fallback;
        }

        const dsName = designSystem.getName() || '';
        const dsVersion = designSystem.getVersion() || '';

        const defaultTags = defaultToken.getTags();
        const groupKebab = defaultTags[1];
        const defaultNameParts = defaultToken.getName().split('.');
        const tokenKebab = defaultNameParts[defaultNameParts.length - 1];

        const postfixes = ['', '-hover', '-active', '-brightness'];

        const matchesToReset = theme.getTokens('color').filter((t) => {
            if (t.getTags()[1] !== groupKebab) {
                return false;
            }

            const last = t.getName().split('.').slice(-1)[0];
            return postfixes.some((p) => last === tokenKebab + p);
        });

        matchesToReset.forEach((token) => {
            const platforms = Object.keys(token.getPlatforms());
            const defaultDescription = token.getDefaultDescription();

            for (const platform of platforms) {
                token.setValue(platform, token.getDefaultValue(platform));
            }

            token.setDescription(defaultDescription);

            updateDraftToken(dsName, dsVersion, token, isDraftAddedToken(token.getName()) ? 'save' : 'remove');
        });

        const [colorValue, opacityValue] = getColorAndOpacity(defaultToken.getDefaultValue('web'));

        return {
            color: colorValue,
            opacity: opacityValue,
            description: defaultToken.getDefaultDescription(),
        };
    },
};
