// INFO: Файл частично скопирован из репозитория plasma/website/plasma-theme-builder

import { Breakpoint, ThemeMeta, TokensContent, Variation } from '../types/index.ts';

export const getSelector = (content: string, selector = ':root') => `
${selector} {
${content}
}`;

/**
 * Медиазапрос экрана: `from` — `min-width`, `to` — `max-width`. Границы проверяются на `undefined`, а не на
 * истинность, как в `getMediaQuery` из plasma-tokens-utils: там `0` теряется, а одиночные границы перевёрнуты.
 */
const getMediaQuery = ({ from, to }: Breakpoint) =>
    [from !== undefined && `(min-width: ${from}px)`, to !== undefined && `(max-width: ${to}px)`]
        .filter(Boolean)
        .join(' and ');

export const getBreakpointSelector = (content: string, breakpoint: Breakpoint, selector = ':root') => {
    const indent = '    ';

    return `
@media ${getMediaQuery(breakpoint)} {
  ${selector} {
${content.replace(/ {2}/gim, indent)}
  }
}`;
};

/** Блоки адаптивной типографики в порядке брейкпоинтов; экран без границ выводится без медиазапроса. */
export const getTypographyBreakpoints = (
    typography: TokensContent['typographyTokens'],
    breakpoints: Breakpoint[],
    selector?: string,
) =>
    breakpoints.map((breakpoint) =>
        breakpoint.from === undefined && breakpoint.to === undefined
            ? getSelector(typography[breakpoint.name], selector)
            : getBreakpointSelector(typography[breakpoint.name], breakpoint, selector),
    );
