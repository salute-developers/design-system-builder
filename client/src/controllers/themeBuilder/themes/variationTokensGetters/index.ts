import { getAdditionalColorThemeTokens } from './getAdditionalColorThemeTokens';
import { getAdditionalGradientAndroidThemeTokens } from './getAdditionalGradientAndroidThemeTokens';
import { getAdditionalGradientIOSThemeTokens } from './getAdditionalGradientIOSThemeTokens';
import { getAdditionalGradientWebThemeTokens } from './getAdditionalGradientWebThemeTokens';
import { ExtraThemeTokensGetters } from '../createVariationTokens';

export const extraThemeTokenGetters: ExtraThemeTokensGetters = {
    color: {
        web: getAdditionalColorThemeTokens,
        ios: getAdditionalColorThemeTokens,
        android: getAdditionalColorThemeTokens,
    },
    gradient: {
        web: getAdditionalGradientWebThemeTokens,
        ios: getAdditionalGradientIOSThemeTokens,
        android: getAdditionalGradientAndroidThemeTokens,
    },
};
