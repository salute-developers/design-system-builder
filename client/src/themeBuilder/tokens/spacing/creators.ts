import { ThemeConfig } from '@salutejs/plasma-tokens-utils';

import { AndroidSpacing, SpacingToken, IOSSpacing, WebSpacing } from './spacing';
import { spacingTokens, getWebTokens, getIOSTokens, getAndroidTokens } from './default';
import { PlatformsVariations, TokenType } from '../../types';

export const createDefaultSpacingTokens = (config: ThemeConfig): SpacingToken[] => {
    const webTokens = getWebTokens(config);
    const iosTokens = getIOSTokens(config);
    const androidTokens = getAndroidTokens(config);

    return spacingTokens.map((token) => {
        const web = webTokens[token.name];
        const ios = iosTokens[token.name];
        const android = androidTokens[token.name];

        if (!web || !ios || !android) {
            throw new Error(`Токен '${token.name}' не найден`);
        }

        const values = {
            web: new WebSpacing(web),
            ios: new IOSSpacing(ios),
            android: new AndroidSpacing(android),
        };

        return new SpacingToken(token, values);
    });
};

export const createSpacingTokens = (tokens: Array<TokenType>, platforms: PlatformsVariations['spacing']) =>
    tokens.map((token) => {
        const web = platforms.web[token.name];
        const ios = platforms.ios[token.name];
        const android = platforms.android[token.name];

        if (!web || !ios || !android) {
            throw new Error(`Токен '${token.name}' не найден`);
        }

        const values = {
            web: new WebSpacing(web),
            ios: new IOSSpacing(ios),
            android: new AndroidSpacing(android),
        };

        return new SpacingToken(token, values);
    });

// TODO: Удалить метод после завершения разработки разделов с токенами
export const createMockSpacingTokens = () => {
    const token = {
        displayName: 'spacingName',
        enabled: true,
        name: 'spacing.name',
        tags: ['spacing', 'name'],
        description: 'Description',
    };

    const values = {
        web: new WebSpacing(''),
        ios: new IOSSpacing({
            value: 0,
        }),
        android: new AndroidSpacing({
            value: 0,
        }),
    };

    const spacing = new SpacingToken(token, values);

    return [spacing];
};
