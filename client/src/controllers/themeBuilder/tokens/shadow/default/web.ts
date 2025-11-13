import { ThemeConfig } from '../../../types';
import { WebShadowToken } from '../types';

export const getWebTokens = (config: ThemeConfig): WebShadowToken => ({
    'down.soft.s': ['0rem 0.25rem 0.875rem -0.25rem #08080814', '0rem 0.0625rem 0.25rem -0.0625rem #0000000A'],
    'down.soft.m': ['0rem 1.5rem 3rem -0.5rem #00000014'],
    'down.soft.l': ['0rem 3.75rem 7rem -0.5rem #00000014'],
    'down.hard.s': ['0rem 0.25rem 0.75rem -0.1875rem #08080829', '0rem 0.0625rem 0.25rem -0.125rem #00000014'],
    'down.hard.m': ['0rem 1rem 2rem -0.5rem #0000003D'],
    'down.hard.l': ['0rem 3.75rem 7rem -0.5rem #00000066'],
    'up.soft.s': ['0rem -0.25rem 0.875rem -0.25rem #08080814', '0rem -0.0625rem 0.25rem -0.0625rem #00000008'],
    'up.soft.m': ['0rem -1.5rem 3rem -0.5rem #00000014'],
    'up.soft.l': ['0rem -3.75rem 7rem -0.5rem #00000014'],
    'up.hard.s': ['0rem -0.25rem 0.75rem -0.1875rem #08080833', '0rem -0.0625rem 0.25rem -0.0625rem #00000008'],
    'up.hard.m': ['0rem -1rem 2rem -0.5rem #0000003D'],
    'up.hard.l': ['0rem -3.75rem 7rem -0.5rem #00000066'],
});
