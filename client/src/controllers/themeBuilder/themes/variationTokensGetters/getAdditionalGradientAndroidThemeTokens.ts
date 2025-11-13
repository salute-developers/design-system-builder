import { GradientToken } from '../../tokens';
import type { PlatformsVariations } from '../../types';

export const getAdditionalGradientAndroidThemeTokens = (
    token: GradientToken,
): PlatformsVariations['gradient']['android'] | undefined => {
    // TODO: Добавить генерацию токенов для градиентов
    return {
        [`${token.getName()}-hover`]: token.getValue('android'),
        [`${token.getName()}-active`]: token.getValue('android'),
        [`${token.getName()}-brightness`]: token.getValue('android'),
    };
};
