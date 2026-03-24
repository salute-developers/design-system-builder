import { Theme, WebTypographyToken } from '../../../../controllers';

export const getTokenValue = (token: WebTypographyToken[string], theme: Theme) => {
    const { fontFamilyRef, fontStyle, fontWeight, ...values } = token;

    const fontFamily =
        theme.getTokenValue(fontFamilyRef.replace('fontFamily.', ''), 'fontFamily', 'web')?.name || 'Font Family';
    const fontSize = (parseFloat(values.fontSize) * 16).toString();
    const lineHeight = (parseFloat(values.lineHeight) * 16).toString();
    const letterSpacing = values.letterSpacing === 'normal' ? '0' : Number(parseFloat(values.letterSpacing)).toString();

    return {
        fontFamily,
        fontWeight,
        fontStyle,
        fontSize,
        lineHeight,
        letterSpacing,
    };
};

export const screenSizeList = [
    {
        label: 'Большой',
        value: 0,
    },
    {
        label: 'Средний',
        value: 1,
    },
    {
        label: 'Маленький',
        value: 2,
    },
];
