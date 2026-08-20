import { ReactNode } from 'react';
import { getRestoredColorFromPalette } from '@salutejs/plasma-tokens-utils';
import { textNegative } from '@salutejs/plasma-themes/tokens/plasma_infra';
import { IconInfoCircleOutline } from '@salutejs/plasma-icons';

import { Theme } from '../../../../controllers';

import { StyledWCAGBadStatus } from './TokenColorPreview.styles';

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
