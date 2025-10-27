import { GradientToken } from '../../tokens';
import type { PlatformsVariations } from '../../types';

export const getAdditionalGradientWebThemeTokens = (
    token: GradientToken,
): PlatformsVariations['gradient']['web'] | undefined => {
    // TODO: Добавить генерацию токенов для градиентов
    return {
        [`${token.getName()}-hover`]: token.getValue('web'),
        [`${token.getName()}-active`]: token.getValue('web'),
        [`${token.getName()}-brightness`]: token.getValue('web'),
    };
};
