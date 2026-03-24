import { GradientToken } from '../../tokens';
import type { PlatformsVariations } from '../../types';

export const getAdditionalGradientIOSThemeTokens = (
    token: GradientToken,
): PlatformsVariations['gradient']['ios'] | undefined => {
    // TODO: Добавить генерацию токенов для градиентов
    return {
        [`${token.getName()}-hover`]: token.getValue('ios'),
        [`${token.getName()}-active`]: token.getValue('ios'),
        [`${token.getName()}-brightness`]: token.getValue('ios'),
    };
};
