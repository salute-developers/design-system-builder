import { AndroidGradient, DesignSystem, GradientToken, Theme, WebGradient, IOSGradient, Token } from '../controllers';
import {
    camelToKebab,
    kebabToCamel,
    createDraftToken,
    updateDraftToken,
    renameDraftToken,
    isDraftAddedToken,
} from '../utils';
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

interface RenameTokenGroupProps {
    defaultToken?: GradientToken;
    newDisplayName: string;
    theme?: Theme;
    designSystem?: DesignSystem;
}

interface DeleteTokenGroupProps {
    defaultToken?: GradientToken;
    theme?: Theme;
    designSystem?: DesignSystem;
}

interface ResetTokenGroupProps {
    defaultToken?: GradientToken;
    theme?: Theme;
    designSystem?: DesignSystem;
}

interface GradientTokenActions {
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

export const gradientTokenActions: GradientTokenActions = {
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

        const isTokenExist = theme.getToken(`dark.${groupKebab}.default.${tokenKebab}`, 'gradient');
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
        const postfixes = ['', '-hover', '-active'];

        themeModes.forEach((themeMode) => {
            subgroups.forEach(({ subgroupKebab, displayPrefix }) => {
                postfixes.forEach((postfix) => {
                    const token = new GradientToken(
                        createMeta(themeMode, subgroupKebab, displayPrefix, postfix || undefined),
                        {
                            web: new WebGradient(defaultValue),
                            ios: new IOSGradient(defaultNativeValue),
                            android: new AndroidGradient(defaultNativeValue),
                        },
                    );
                    theme.addToken('gradient', token);
                    createDraftToken(dsName, dsVersion, token);
                });
            });
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

        const postfixes = ['-hover', '-active'];

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

        const allGradientTokens = theme.getTokens('gradient');

        allGradientTokens.forEach((targetToken) => {
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

        const postfixes = ['', '-hover', '-active'];

        const matchesToRemove = theme
            .getTokens('gradient')
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
            theme.removeToken(name, 'gradient');
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

        const postfixes = ['', '-hover', '-active'];

        const matchesToReset = theme.getTokens('gradient').filter((t) => {
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

        const defaultWeb = defaultToken.getDefaultValue('web');

        return {
            color: Array.isArray(defaultWeb) ? defaultWeb.join(', ') : String(defaultWeb),
            opacity: 1,
            description: defaultToken.getDefaultDescription(),
        };
    },
};
