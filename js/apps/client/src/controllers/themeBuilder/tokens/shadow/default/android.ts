import { ThemeConfig } from '../../../types';
import { AndroidShadowToken } from '../types';

export const getAndroidTokens = (config: ThemeConfig): AndroidShadowToken => ({
    'down.soft.s': [
        {
            color: '#08080814',
            offsetX: 0,
            offsetY: 4,
            spreadRadius: -4,
            blurRadius: 14,
            fallbackElevation: 2,
        },
        {
            color: '#0000000A',
            offsetX: 0,
            offsetY: 1,
            spreadRadius: -1,
            blurRadius: 4,
        },
    ],
    'down.soft.m': [
        {
            color: '#00000014',
            offsetX: 0,
            offsetY: 24,
            spreadRadius: -8,
            blurRadius: 48,
            fallbackElevation: 4,
        },
    ],
    'down.soft.l': [
        {
            color: '#00000014',
            offsetX: 0,
            offsetY: 60,
            spreadRadius: -8,
            blurRadius: 112,
            fallbackElevation: 6,
        },
    ],
    'down.hard.s': [
        {
            color: '#08080829',
            offsetX: 0,
            offsetY: 4,
            spreadRadius: -3,
            blurRadius: 12,
            fallbackElevation: 2,
        },
        {
            color: '#00000014',
            offsetX: 0,
            offsetY: 1,
            spreadRadius: -2,
            blurRadius: 4,
        },
    ],
    'down.hard.m': [
        {
            color: '#0000003D',
            offsetX: 0,
            offsetY: 16,
            spreadRadius: -8,
            blurRadius: 32,
            fallbackElevation: 4,
        },
    ],
    'down.hard.l': [
        {
            color: '#00000066',
            offsetX: 0,
            offsetY: 60,
            spreadRadius: -8,
            blurRadius: 112,
            fallbackElevation: 6,
        },
    ],
    'up.soft.s': [
        {
            color: '#08080814',
            offsetX: 0,
            offsetY: -4,
            spreadRadius: -4,
            blurRadius: 14,
        },
        {
            color: '#00000008',
            offsetX: 0,
            offsetY: -1,
            spreadRadius: -1,
            blurRadius: 4,
        },
    ],
    'up.soft.m': [
        {
            color: '#00000014',
            offsetX: 0,
            offsetY: -24,
            spreadRadius: -8,
            blurRadius: 48,
        },
    ],
    'up.soft.l': [
        {
            color: '#00000014',
            offsetX: 0,
            offsetY: -60,
            spreadRadius: -8,
            blurRadius: 112,
        },
    ],
    'up.hard.s': [
        {
            color: '#08080833',
            offsetX: 0,
            offsetY: -4,
            spreadRadius: -3,
            blurRadius: 12,
        },
        {
            color: '#00000008',
            offsetX: 0,
            offsetY: -1,
            spreadRadius: -1,
            blurRadius: 4,
        },
    ],
    'up.hard.m': [
        {
            color: '#0000003D',
            offsetX: 0,
            offsetY: -16,
            spreadRadius: -8,
            blurRadius: 32,
        },
    ],
    'up.hard.l': [
        {
            color: '#00000066',
            offsetX: 0,
            offsetY: -60,
            spreadRadius: -8,
            blurRadius: 112,
        },
    ],
});
