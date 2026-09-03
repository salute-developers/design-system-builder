import styled, { css, CSSObject } from 'styled-components';
import { bodyM } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../../utils';

export const Root = styled.div<{ backgroundColor?: string; textColor?: string; size?: 'l' | 'm' }>`
    position: relative;
    z-index: 999;

    box-sizing: border-box;
    cursor: pointer;
    width: fit-content;

    display: inline-flex;
    justify-content: center;
    align-items: center;

    gap: 0.625rem;

    ${({ size }) =>
        size === 'l' &&
        css`
            ${bodyM as CSSObject};

            padding: 1.125rem 1.5rem 1.125rem 1.75rem;
            border-radius: 0.375rem;
        `}

    ${({ size }) =>
        size === 'm' &&
        css`
            ${h6 as CSSObject};

            padding: 0.25rem 0.625rem;
            border-radius: 0.375rem;
        `}

    background: ${({ backgroundColor }) =>
        backgroundColor ? backgroundColor : 'var(--surface-transparent-secondary)'};
    color: ${({ textColor }) => (textColor ? textColor : '#ffffff')};

    transition: transform 0.1s ease-in-out;

    :hover {
        transform: scale(1.02);
    }

    :active {
        transform: scale(0.99);
    }
`;

export const StyledText = styled.div`
    user-select: none;
`;

export const StyledContentRight = styled.div`
    display: inline-flex;
    justify-content: center;
    align-items: center;
`;
