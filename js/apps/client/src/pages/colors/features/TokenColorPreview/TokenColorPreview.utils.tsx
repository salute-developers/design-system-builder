import { ReactNode } from 'react';
import { textNegative } from '@salutejs/plasma-themes/tokens/plasma_infra';
import { IconInfoCircleOutline } from '@salutejs/plasma-icons';

import { Theme } from '../../../../controllers';

import { StyledWCAGBadStatus } from './TokenColorPreview.styles';
import { restorePaletteColor } from '../../../../palette/activePalette';

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
                value: restorePaletteColor(item.getValue('web'), 0, item.getName()),
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
