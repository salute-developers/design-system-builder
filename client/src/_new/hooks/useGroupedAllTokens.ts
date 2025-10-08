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

export const useGroupedAllTokens = (theme: Theme | null) => {
    const [colorMode, setColorMode, groupedColorTokens] = useGroupedTokens(
        theme?.getTokens('color') || [],
        'dark',
        getGroupedColorTokens,
    );

    const [gradientMode, setGradientMode, groupedGradientTokens] = useGroupedTokens(
        theme?.getTokens('gradient') || [],
        'dark',
        getGroupedGradientTokens,
    );

    const [shapeMode, setShapeMode, groupedShapeTokens] = useGroupedTokens(
        theme?.getTokens('shape') || [],
        'round',
        getGroupedShapeTokens,
    );

    const [spacingMode, setsSpacingMode, groupedSpacingTokens] = useGroupedTokens(
        theme?.getTokens('spacing') || [],
        'spacing',
        getGroupedSpacingTokens,
    );

    const [shadowMode, setShadowMode, groupedShadowTokens] = useGroupedTokens(
        theme?.getTokens('shadow') || [],
        'up',
        getGroupedShadowTokens,
    );

    const [typographyMode, setTypographyMode, groupedTypographyTokens] = useGroupedTokens(
        theme?.getTokens('typography') || [],
        'screen-s',
        getGroupedTypographyTokens,
    );

    const [fontFamilyMode, setFontFamilyMode, groupedFontFamilyTokens] = useGroupedTokens(
        theme?.getTokens('fontFamily') || [],
        'display',
        getGroupedFontFamilyTokens,
    );

    return [
        {
            value: 'color',
            mode: colorMode,
            set: setColorMode,
            group: groupedColorTokens,
        },
        {
            value: 'gradient',
            mode: gradientMode,
            set: setGradientMode,
            group: groupedGradientTokens,
        },
        {
            value: 'shape',
            mode: shapeMode,
            set: setShapeMode,
            group: groupedShapeTokens,
        },
        {
            value: 'spacing',
            mode: spacingMode,
            set: setsSpacingMode,
            group: groupedSpacingTokens,
        },
        {
            value: 'shadow',
            mode: shadowMode,
            set: setShadowMode,
            group: groupedShadowTokens,
        },
        {
            value: 'typography',
            mode: typographyMode,
            set: setTypographyMode,
            group: groupedTypographyTokens,
        },
        {
            value: 'fontFamily',
            mode: fontFamilyMode,
            set: setFontFamilyMode,
            group: groupedFontFamilyTokens,
        },
    ] as const;
};
