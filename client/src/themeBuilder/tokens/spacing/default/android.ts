import { ThemeConfig } from '@salutejs/plasma-tokens-utils';

import { AndroidSpacingToken } from '../types';

export const getAndroidTokens = (config: ThemeConfig): AndroidSpacingToken => ({
    'spacing.0x': {
        value: 0,
    },
    'spacing.1x': {
        value: 2,
    },
    'spacing.2x': {
        value: 4,
    },
    'spacing.3x': {
        value: 6,
    },
    'spacing.4x': {
        value: 8,
    },
    'spacing.6x': {
        value: 12,
    },
    'spacing.8x': {
        value: 16,
    },
    'spacing.10x': {
        value: 20,
    },
    'spacing.12x': {
        value: 24,
    },
    'spacing.16x': {
        value: 32,
    },
    'spacing.20x': {
        value: 40,
    },
    'spacing.24x': {
        value: 48,
    },
    'spacing.32x': {
        value: 64,
    },
    'spacing.40x': {
        value: 80,
    },
    'spacing.60x': {
        value: 120,
    },
});
