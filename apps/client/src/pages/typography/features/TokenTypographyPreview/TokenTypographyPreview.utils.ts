import { getRestoredColorFromPalette } from '@salutejs/plasma-tokens-utils';

import { Theme } from '../../../../controllers';
import { TypographyType } from '../../../../features';

export const getColorsTokens = (theme?: Theme) => {
    if (!theme) {
        return [];
    }

    return theme
        .getTokens('color')
        .filter(
            (item) =>
                item.getEnabled() &&
                !item.getName().includes('hover') &&
                !item.getName().includes('active') &&
                !item.getName().includes('brightness'),
        )
        .map((item) => {
            return {
                label: item.getName(),
                value: getRestoredColorFromPalette(item.getValue('web')),
            };
        });
};

export const getTypographyTokens = (theme?: Theme) => {
    if (!theme) {
        return [];
    }

    return theme
        .getTokens('typography')
        .filter((item) => item.getEnabled())
        .map((item) => {
            return {
                label: item.getName(),
                value: item.getName(),
            };
        });
};

export const getWebValue = (value: TypographyType) => {
    const { fontSize, lineHeight, fontStyle, fontWeight, letterSpacing, fontFamily } = value;

    return {
        fontFamily,
        fontWeight,
        fontStyle,
        fontSize: `${Number(fontSize) / 16}rem`,
        lineHeight: `${Number(lineHeight) / 16}rem`,
        letterSpacing: Number(letterSpacing) === 0 ? 'normal' : `${Number(letterSpacing) / 16}em`,
    };
};

export const TEXT_EXAMPLE = `Юный директор целиком сжевал весь объём продукции фундука (товара дефицитного и деликатесного), идя энергично через хрустящий камыш.`;

export const defaultTokens = {
    DARK_TEXT_DEFAULT_PRIMARY: 'dark.text.default.primary',
    SCREEN_S_BODY_M_BOLD: 'screen-s.body.m.bold',
    SCREEN_S_BODY_S_BOLD: 'screen-s.body.s.bold',
};
