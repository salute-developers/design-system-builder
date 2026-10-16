// INFO: Файл частично скопирован из репозитория plasma/website/plasma-theme-builder

import { getMediaQuery } from '@salutejs/plasma-tokens-utils';

import { ThemeMeta, Variation } from '../types/index.ts';

export const getSelector = (content: string, selector = ':root') => `
${selector} {
${content}
}`;

export const getBreakpointSelector = (content: string, from?: number, to?: number, selector = ':root') => {
    const indent = '    ';
    const mediaQuery = getMediaQuery(from, to);

    return `
${mediaQuery} {
  ${selector} {
${content.replace(/ {2}/gim, indent)}
  }
}`;
};
