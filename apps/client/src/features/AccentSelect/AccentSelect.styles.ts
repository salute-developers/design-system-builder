import styled, { css, CSSObject } from 'styled-components';
import { h1, textPrimary, textSecondary, textTertiary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../../utils';

export const Root = styled.div``;

export const StyledLabel = styled.div`
    color: ${textTertiary};

    ${h6 as CSSObject};
`;

export const StyledItems = styled.div`
    margin-top: 0.75rem;
    user-select: none;

    // TODO: Подумать, можно ли как-то перенести
    margin-left: -22.5rem;
    padding-left: 22.5rem;
    margin-right: -5rem;
    padding-right: 5rem;

    overflow-x: scroll;
    overflow-y: hidden;

    scrollbar-width: none;
    -ms-overflow-style: none;

    &::-webkit-scrollbar {
        display: none;
    }

    display: flex;
    align-items: center;
    gap: 2rem;

    cursor: pointer;

    &:active {
        cursor: grabbing;
    }
`;

export const StyledItem = styled.div<{ color: string }>`
    position: relative;
    white-space: nowrap;
    user-select: none;

    ${h1 as CSSObject};

    background: ${({ color }) => css`linear-gradient(to right, transparent 0 50%, ${color} 100%),
        linear-gradient(to left, ${textPrimary} 0%, ${textSecondary} 100%)`};

    background-size: 200% 100%;
    background-position: 0% 0;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    transition: background-position 0.3s linear;

    &:hover {
        background-position: 100% 0;
    }

    &:after {
        content: '';
        position: absolute;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: ${({ color }) => color};
        opacity: 0;
        transition: opacity 0.3s linear;
    }

    &:hover {
        &:after {
            opacity: 1;
        }
    }
`;

