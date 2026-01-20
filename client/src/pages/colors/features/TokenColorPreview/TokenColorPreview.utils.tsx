import { ReactNode } from 'react';
import { ContrastRatioChecker } from 'contrast-ratio-checker';
import { getRestoredColorFromPalette } from '@salutejs/plasma-tokens-utils';
import { textNegative } from '@salutejs/plasma-themes/tokens/plasma_infra';
import { IconInfoCircleOutline } from '@salutejs/plasma-icons';

import { roundTo } from '../../../../utils';
import { Theme } from '../../../../controllers';

import { StyledWCAGBadStatus } from './TokenColorPreview.styles';

const checker = new ContrastRatioChecker();

export const getColorsTokens = (theme?: Theme) => {
    if (!theme) {
        return [];
    }

    const colors = theme.getTokens('color');

    const items = colors
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

    return items;
};

export const getContrastRatio = (color: string, background: string) => {
    const first = color?.length === 9 ? color.slice(0, -2) : color;
    const second = background?.length === 9 ? background.slice(0, -2) : background;

    return Number(roundTo(checker.getContrastRatioByHex(first || '#FFFFFF', second || '#000000'), 2));
};

export const getContrastStatus = (contrastRatio: number, textSize: 'small' | 'large'): ReactNode => {
    if ((textSize === 'large' && contrastRatio >= 4.5) || (textSize === 'small' && contrastRatio >= 7)) {
        return 'AAA Отлично';
    }

    if ((textSize === 'large' && contrastRatio >= 3) || (textSize === 'small' && contrastRatio >= 4.5)) {
        return 'AA Хорошо';
    }

    return (
        <StyledWCAGBadStatus>
            Плохо <IconInfoCircleOutline size="xs" color={textNegative} />
        </StyledWCAGBadStatus>
    );
};
