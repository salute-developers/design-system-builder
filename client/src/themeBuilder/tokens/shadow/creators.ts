import { AndroidShadow, ShadowToken, IOSShadow, WebShadow } from './shadow';
import { shadowTokens, getWebTokens, getIOSTokens, getAndroidTokens } from './default';
import { PlatformsVariations, ThemeConfig, TokenType } from '../../types';

export const createDefaultShadowTokens = (config: ThemeConfig): ShadowToken[] => {
    const webTokens = getWebTokens(config);
    const iosTokens = getIOSTokens(config);
    const androidTokens = getAndroidTokens(config);

    return shadowTokens.map((token) => {
        const web = webTokens[token.name];
        const ios = iosTokens[token.name];
        const android = androidTokens[token.name];

        if (web === undefined || ios === undefined || android === undefined) {
            throw new Error(`Токен теней '${token.name}' не найден`);
        }

        const values = {
            web: new WebShadow(web),
            ios: new IOSShadow(ios),
            android: new AndroidShadow(android),
        };

        return new ShadowToken(token, values);
    });
};

export const createShadowTokens = (tokens: Array<TokenType>, platforms: PlatformsVariations['shadow']) =>
    tokens.map((token) => {
        const web = platforms.web[token.name];
        const ios = platforms.ios[token.name];
        const android = platforms.android[token.name];

        if (web === undefined || ios === undefined || android === undefined) {
            throw new Error(`Токен теней '${token.name}' не найден`);
        }

        const values = {
            web: new WebShadow(web),
            ios: new IOSShadow(ios),
            android: new AndroidShadow(android),
        };

        return new ShadowToken(token, values);
    });

// TODO: Удалить метод после завершения разработки разделов с токенами
export const createMockShadowTokens = () => {
    const token = {
        displayName: 'shadowName',
        enabled: true,
        name: 'shadow.name',
        tags: ['shadow', 'name'],
        description: 'Description',
    };

    const values = {
        web: new WebShadow([]),
        ios: new IOSShadow([]),
        android: new AndroidShadow([]),
    };

    const shadow = new ShadowToken(token, values);

    return [shadow];
};
