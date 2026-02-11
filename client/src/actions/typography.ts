import { upperFirstLetter } from '@salutejs/plasma-tokens-utils';

import {
    AndroidFontWeight,
    AndroidTypography,
    DesignSystem,
    IOSFontStyle,
    IOSFontWeight,
    IOSTypography,
    Theme,
    Token,
    TypographyToken,
    WebTypography,
} from '../controllers';
import { TypographyType } from '../features';
import { camelToKebab, kebabToCamel, updateTokenChange } from '../utils';

interface AddTokenProps {
    groupName: string;
    tokenName: string;
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
    value: TypographyType;
    token?: TypographyToken;
    designSystem?: DesignSystem;
}

interface ResetTokenProps {
    token?: TypographyToken;
    designSystem?: DesignSystem;
}

interface TypographyTokenActions {
    addToken: (props: AddTokenProps) => void;
    disableToken: (props: DisableTokenProps) => void;
    updateToken: (props: UpdateTokenProps) => void;
    resetToken: (props: ResetTokenProps) => void;
}

export const typographyTokenActions: TypographyTokenActions = {
    addToken: ({ groupName, tokenName, tokens, theme, designSystem }: AddTokenProps) => {
        if (!theme || !tokens) {
            return;
        }

        const rest = [camelToKebab(groupName), camelToKebab(tokenName)];

        const isTokenExist = theme.getToken(['screen-s', ...rest, 'normal'].join('.'), 'typography');

        if (isTokenExist) {
            console.warn('Токен уже существует');
            return;
        }

        const createMeta = (screenSize: string, fontMode: string) => ({
            tags: [screenSize, ...rest, fontMode],
            name: [screenSize, ...rest, fontMode].join('.'),
            displayName: kebabToCamel(
                `${camelToKebab(groupName)}-${camelToKebab(tokenName)} ${upperFirstLetter(fontMode)[0]}`,
            ),
            description: 'New description',
            enabled: true,
        });

        const dsName = designSystem?.getName() || '';
        const dsVersion = designSystem?.getVersion() || '';

        tokens.forEach((token) => {
            const [screenSize, ..._] = (token as Token).getTags();

            ['normal', 'medium', 'bold'].forEach((fontMode) => {
                const newToken = new TypographyToken(createMeta(screenSize, fontMode), {
                    web: new WebTypography({
                        fontFamilyRef: 'fontFamily.display',
                        fontWeight: '100',
                        fontStyle: 'normal',
                        fontSize: '0',
                        lineHeight: '0',
                        letterSpacing: '0',
                    }),
                    ios: new IOSTypography({
                        fontFamilyRef: 'fontFamily.display',
                        weight: 'black',
                        style: 'normal',
                        size: 0,
                        lineHeight: 0,
                        kerning: 0,
                    }),
                    android: new AndroidTypography({
                        fontFamilyRef: 'fontFamily.display',
                        fontWeight: 100,
                        fontStyle: 'normal',
                        textSize: 0,
                        lineHeight: 0,
                        letterSpacing: 0,
                    }),
                });

                theme.addToken('typography', newToken);
                updateTokenChange(dsName, dsVersion, newToken);
            });
        });
    },
    disableToken: ({ disabled, tokens, designSystem }: DisableTokenProps) => {
        const dsName = designSystem?.getName() || '';
        const dsVersion = designSystem?.getVersion() || '';

        (tokens as Token[]).forEach((token) => {
            token.setEnabled(disabled);
            updateTokenChange(dsName, dsVersion, token);
        });
    },
    updateToken: ({ value, token, designSystem }: UpdateTokenProps) => {
        if (!token || !designSystem) {
            return;
        }

        const dsName = designSystem.getName() || '';
        const dsVersion = designSystem.getVersion() || '';

        const { fontSize, lineHeight, fontStyle, fontWeight, letterSpacing } = value;

        const webValue = {
            fontFamilyRef: token.getValue('web').fontFamilyRef,
            fontWeight,
            fontStyle,
            fontSize: `${Number(fontSize) / 16}rem`,
            lineHeight: `${Number(lineHeight) / 16}rem`,
            letterSpacing: Number(letterSpacing) === 0 ? 'normal' : `${Number(letterSpacing) / 16}em`,
        };

        const iosFontWeightMap = {
            '900': 'black',
            '800': 'bold',
            '700': 'heavy',
            '600': 'semibold',
            '500': 'medium',
            '400': 'regular',
            '300': 'light',
            '200': 'ultraLight',
            '100': 'thin',
        };

        const iosValue = {
            fontFamilyRef: token.getValue('ios').fontFamilyRef,
            weight: iosFontWeightMap[fontWeight] as IOSFontWeight,
            style: fontStyle as IOSFontStyle,
            size: Number(fontSize),
            lineHeight: Number(lineHeight),
            kerning: Number(letterSpacing),
        };

        const androidValue = {
            fontFamilyRef: token.getValue('android').fontFamilyRef,
            fontWeight: Number(fontWeight) as AndroidFontWeight,
            fontStyle,
            textSize: Number(fontSize),
            lineHeight: Number(lineHeight),
            letterSpacing: Number(letterSpacing),
        };

        token.setValue('web', webValue);
        token.setValue('ios', iosValue);
        token.setValue('android', androidValue);
        updateTokenChange(dsName, dsVersion, token);
    },
    resetToken: ({ token, designSystem }: ResetTokenProps) => {
        if (!token || !designSystem) {
            return;
        }

        const dsName = designSystem.getName() || '';
        const dsVersion = designSystem.getVersion() || '';

        const defaultDescription = token.getDefaultDescription();
        const platforms = Object.keys(token.getPlatforms());

        for (const platform of platforms) {
            token.setValue(platform, token.getDefaultValue(platform));
            token.setDescription(defaultDescription);
        }

        updateTokenChange(dsName, dsVersion, token);
    },
};
