import type { ThemeConfig } from '@salutejs/plasma-tokens-utils';

import type { WebShapeToken } from '../types';

export const getWebTokens = (config: ThemeConfig): WebShapeToken => ({
    'round.xxs': '0.25rem',
    'round.xs': '0.375rem',
    'round.s': '0.5rem',
    'round.m': '0.75rem',
    'round.l': '1rem',
    'round.xl': '1.25rem',
    'round.xxl': '2rem',
    'round.circle': '100rem',
});
