import { getRestoredColorFromPalette } from '@salutejs/plasma-tokens-utils';

import {
    AndroidShadow,
    AndroidShape,
    AndroidSpacing,
    DesignSystem,
    IOSShadow,
    IOSShape,
    IOSSpacing,
    ShadowToken,
    ShapeToken,
    SpacingToken,
    Theme,
    Token,
    WebShadow,
    WebShape,
    WebSpacing,
} from '../controllers';
import { ShadowType } from '../features';
import { camelToKebab, getAlphaHex, kebabToCamel, updateTokenChange } from '../utils';
import { getTokenValue } from '../pages/shapes/features/TokenShapeEditor/TokenShapeEditor.utils';

interface AddTokenProps {
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
    value: string | ShadowType[];
    token?: ShadowToken | ShapeToken | SpacingToken;
    designSystem?: DesignSystem;
}

interface ResetTokenProps {
    token?: ShadowToken | ShapeToken | SpacingToken;
    designSystem?: DesignSystem;
}

interface ShapeTokenActions {
    addToken: (props: AddTokenProps) => void;
    disableToken: (props: DisableTokenProps) => void;
    updateToken: (props: UpdateTokenProps) => void;
    resetToken: (props: ResetTokenProps) => string | ShadowType[];
}

export const shapeTokenActions: ShapeTokenActions = {
    addToken: ({ tokenName, tokens, theme, designSystem }: AddTokenProps) => {
        if (!theme || !tokens?.length) {
            return;
        }

        const dsName = designSystem?.getName() || '';
        const dsVersion = designSystem?.getVersion() || '';

        if (tokens[0] instanceof ShapeToken) {
            const kind = 'round';
            const rest = [kind, camelToKebab(tokenName)];

            const isTokenExist = theme.getToken(rest.join('.'), 'shape');

            if (isTokenExist) {
                console.warn('Токен уже существует');
                return;
            }

            const createMeta = () => ({
                tags: rest,
                name: rest.join('.'),
                displayName: kebabToCamel(`${kind}-${camelToKebab(tokenName)}`),
                description: 'New description',
                enabled: true,
            });

            const newToken = new ShapeToken(createMeta(), {
                web: new WebShape('0'),
                ios: new IOSShape({
                    cornerRadius: 0,
                    kind,
                }),
                android: new AndroidShape({
                    cornerRadius: 0,
                    kind,
                }),
            });

            theme.addToken('shape', newToken);
            updateTokenChange(dsName, dsVersion, newToken);
        }

        if (tokens[0] instanceof ShadowToken) {
            const rest = ['down', 'soft', camelToKebab(tokenName)];
            const isTokenExist = theme.getToken(rest.join('.'), 'shadow');

            if (isTokenExist) {
                console.warn('Токен уже существует');
                return;
            }

            const createMeta = (direction: string, mode: string) => ({
                tags: [direction, mode, camelToKebab(tokenName)],
                name: [direction, mode, camelToKebab(tokenName)].join('.'),
                displayName: kebabToCamel(`${direction}-${mode}-${camelToKebab(tokenName)}`),
                description: 'New description',
                enabled: true,
            });

            ['down', 'up'].forEach((direction) => {
                ['soft', 'hard'].forEach((mode) => {
                    const newToken = new ShadowToken(createMeta(direction, mode), {
                        web: new WebShadow([]),
                        ios: new IOSShadow([]),
                        android: new AndroidShadow([]),
                    });

                    theme.addToken('shadow', newToken);
                    updateTokenChange(dsName, dsVersion, newToken);
                });
            });
        }

        if (tokens[0] instanceof SpacingToken) {
            const kind = 'spacing';
            const rest = [kind, camelToKebab(tokenName)];

            const isTokenExist = theme.getToken(rest.join('.'), 'spacing');

            if (isTokenExist) {
                console.warn('Токен уже существует');
                return;
            }

            const createMeta = () => ({
                tags: rest,
                name: rest.join('.'),
                displayName: kebabToCamel(`${camelToKebab(kind)}-${camelToKebab(tokenName)}`),
                description: 'New description',
                enabled: true,
            });

            const newToken = new SpacingToken(createMeta(), {
                web: new WebSpacing('0'),
                ios: new IOSSpacing({
                    value: 0,
                }),
                android: new AndroidSpacing({
                    value: 0,
                }),
            });

            theme.addToken('spacing', newToken);
            updateTokenChange(dsName, dsVersion, newToken);
        }
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

        if (token instanceof ShapeToken && typeof value === 'string') {
            token.setValue('web', `${parseFloat(value) / 16}rem`);
            token.setValue('ios', {
                kind: 'round',
                cornerRadius: parseFloat(value),
            });
            token.setValue('android', {
                kind: 'round',
                cornerRadius: parseFloat(value),
            });
        }

        if (token instanceof SpacingToken && typeof value === 'string') {
            token.setValue('web', `${parseFloat(value) / 16}rem`);
            token.setValue('ios', {
                value: parseFloat(value),
            });
            token.setValue('android', {
                value: parseFloat(value),
            });
        }

        if (token instanceof ShadowToken && typeof value === 'object') {
            const webValues = value.map(
                ({ offsetX, offsetY, blur, spread, color, opacity }) =>
                    `${parseFloat(offsetX) / 16}rem ${parseFloat(offsetY) / 16}rem ${parseFloat(blur) / 16}rem ${
                        parseFloat(spread) / 16
                    }rem ${getRestoredColorFromPalette(color)}${getAlphaHex(opacity)}`,
            );

            const nativeValues = value.map(({ offsetX, offsetY, blur, spread, color, opacity }, index) => ({
                color: `${getRestoredColorFromPalette(color)}${getAlphaHex(opacity)}`,
                offsetX: parseFloat(offsetX),
                offsetY: parseFloat(offsetY),
                blurRadius: parseFloat(blur),
                spreadRadius: parseFloat(spread),
                fallbackElevation: token.getValue('android')[index]?.fallbackElevation,
            }));

            token.setValue('web', webValues);
            token.setValue('ios', nativeValues);
            token.setValue('android', nativeValues);
        }

        updateTokenChange(dsName, dsVersion, token);
    },
    resetToken: ({ token, designSystem }: ResetTokenProps) => {
        if (!token || !designSystem) {
            return '#FFFFFF';
        }

        const dsName = designSystem.getName() || '';
        const dsVersion = designSystem.getVersion() || '';

        const defaultDescription = token.getDefaultDescription();
        const platforms = Object.keys(token.getPlatforms());

        for (const platform of platforms) {
            token.setValue(platform, token.getDefaultValue(platform) as any);
            token.setDescription(defaultDescription);
        }

        updateTokenChange(dsName, dsVersion, token);

        return getTokenValue(token.getDefaultValue('web'));
    },
};
