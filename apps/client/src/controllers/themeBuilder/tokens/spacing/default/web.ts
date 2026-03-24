import { ThemeConfig } from '../../../types';

import { WebSpacingToken } from '../types';

export const getWebTokens = (config: ThemeConfig): WebSpacingToken => ({
    'spacing.0x': '0rem',
    'spacing.1x': '0.125rem',
    'spacing.2x': '0.25rem',
    'spacing.3x': '0.375rem',
    'spacing.4x': '0.5rem',
    'spacing.6x': '0.75rem',
    'spacing.8x': '1rem',
    'spacing.10x': '1.25rem',
    'spacing.12x': '1.5rem',
    'spacing.16x': '2rem',
    'spacing.20x': '2.5rem',
    'spacing.24x': '3rem',
    'spacing.32x': '4rem',
    'spacing.40x': '5rem',
    'spacing.60x': '7.5rem',
});
