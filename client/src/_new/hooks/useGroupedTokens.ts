import { useState } from 'react';

import { Token } from '../../themeBuilder/tokens/token';

import type { GroupedToken } from '../types';

export const useGroupedTokens = <T extends Token>(
    token: T[],
    defaultMode: string,
    groupedFunction: (token: T[], mode?: string) => GroupedToken<T>[],
) => {
    const [gradientMode, setGradientMode] = useState(defaultMode);
    const groupedGradientTokens = groupedFunction(token, gradientMode);

    return [gradientMode, setGradientMode, groupedGradientTokens] as const;
};
