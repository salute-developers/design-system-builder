import { Theme } from '../../themeBuilder';
import {
    getGroupedColorTokens,
    getGroupedFontFamilyTokens,
    getGroupedGradientTokens,
    getGroupedShadowTokens,
    getGroupedShapeTokens,
    getGroupedSpacingTokens,
    getGroupedTypographyTokens,
} from '../utils';

import { useGroupedTokens } from './useGroupedTokens';

export const useGroupedAllTokens = (theme: Theme) => {
    const [colorMode, setColorMode, groupedColorTokens] = useGroupedTokens(
        theme.getTokens('color'),
        'dark',
        getGroupedColorTokens,
    );

    const [gradientMode, setGradientMode, groupedGradientTokens] = useGroupedTokens(
        theme.getTokens('gradient'),
        'dark',
        getGroupedGradientTokens,
    );

    const [shapeMode, setShapeMode, groupedShapeTokens] = useGroupedTokens(
        theme.getTokens('shape'),
        'round',
        getGroupedShapeTokens,
    );

    const [shadowMode, setShadowMode, groupedShadowTokens] = useGroupedTokens(
        theme.getTokens('shadow'),
        'up',
        getGroupedShadowTokens,
    );

    const [spacingMode, setsSpacingMode, groupedSpacingTokens] = useGroupedTokens(
        theme.getTokens('spacing'),
        'spacing',
        getGroupedSpacingTokens,
    );

    const [typographyMode, setTypographyMode, groupedTypographyTokens] = useGroupedTokens(
        theme.getTokens('typography'),
        'screen-s',
        getGroupedTypographyTokens,
    );

    const [fontFamilyMode, setFontFamilyMode, groupedFontFamilyTokens] = useGroupedTokens(
        theme.getTokens('fontFamily'),
        'display',
        getGroupedFontFamilyTokens,
    );

    return [
        {
            mode: colorMode,
            set: setColorMode,
            group: groupedColorTokens,
        },
        {
            mode: gradientMode,
            set: setGradientMode,
            group: groupedGradientTokens,
        },
        {
            mode: shapeMode,
            set: setShapeMode,
            group: groupedShapeTokens,
        },
        {
            mode: shadowMode,
            set: setShadowMode,
            group: groupedShadowTokens,
        },
        {
            mode: spacingMode,
            set: setsSpacingMode,
            group: groupedSpacingTokens,
        },
        {
            mode: typographyMode,
            set: setTypographyMode,
            group: groupedTypographyTokens,
        },
        {
            mode: fontFamilyMode,
            set: setFontFamilyMode,
            group: groupedFontFamilyTokens,
        },
    ] as const;
};
