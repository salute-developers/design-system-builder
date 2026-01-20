import styled, { css, CSSObject } from 'styled-components';
import { h1, h5, textParagraph, textPrimary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { LinkButton } from '../../components';

export const Root = styled.div``;

export const StyledSelectedParameters = styled.div<{ isReady?: boolean }>`
    z-index: 999;

    height: calc(100vh - 3rem);

    position: relative;

    ${({ isReady }) =>
        isReady
            ? css`
                  left: -21.25rem;
              `
            : css`
                  left: 0;
              `}

    transition: left 0.5s ease-in-out;
`;

export const StyledWrapper = styled.div`
    display: flex;
    flex-direction: column;
`;

export const StyledReadyBlock = styled.div<{ isReady?: boolean }>`
    position: absolute;

    top: 3.75rem;

    ${({ isReady }) =>
        isReady
            ? css`
                  left: 22.5rem;
                  opacity: 1;
                  transition:
                      left 0.5s ease-in-out 0.5s,
                      opacity 0.5s ease-in-out 0.5s;
              `
            : css`
                  left: 25rem;
                  opacity: 0;
                  transition:
                      left 0.5s ease-in-out,
                      opacity 0.5s ease-in-out;
              `}
`;

export const StyledHeader = styled.div`
    user-select: none;

    width: 30rem;

    margin-bottom: 4rem;

    color: ${textPrimary};

    ${h1 as CSSObject};
`;

export const StyledDisclaimer = styled.div`
    width: 16.25rem;

    margin-top: 2.5rem;

    color: ${textParagraph};

    ${h5 as CSSObject};
`;

export const StyledThemeModeSwitcher = styled.span<{ color: string }>`
    position: relative;
    display: inline-block;
    z-index: 99999;

    cursor: pointer;

    color: ${({ color }) => color};

    transition: transform 0.1s ease-in-out;

    :hover {
        transform: scale(1.02);
    }

    :active {
        transform: scale(0.99);
    }
`;

export const StyledLinkButton = styled(LinkButton)`
    position: absolute;
    bottom: 3rem;
`;

export const StyledSeparator = styled.div`
    height: 1.5rem;
`;
