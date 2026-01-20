import styled, { css, CSSObject } from 'styled-components';
import {
    inverseTextSecondary,
    onLightSurfaceSolidCard,
    surfaceSolidCard,
    textParagraph,
    textPrimary,
    textSecondary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../../utils';

export const Root = styled.div`
    z-index: 9999;
    max-height: 15.75rem;
    overflow-y: auto;
    overflow-x: hidden;

    position: absolute;
    border-radius: 0.375rem;
    // TODO: использовать токен --Surface-General-Primary
    background: ${surfaceSolidCard};

    box-shadow: 0 24px 48px -8px rgba(0, 0, 0, 0.08);
`;

export const StyledBeforeList = styled.div`
    width: 100%;
    min-height: 1.6rem;
    position: relative;
`;

export const StyledItem = styled.div<{ selected?: boolean; disabled?: boolean }>`
    color: ${({ selected }) => (selected ? inverseTextSecondary : textSecondary)};
    background: ${({ selected }) => (selected ? onLightSurfaceSolidCard : 'transparent')};

    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.25rem;
    // justify-content: space-between;

    padding: 0.25rem 0.375rem;
    border-radius: 0.375rem;

    ${({ selected, disabled }) =>
        !selected &&
        !disabled &&
        css`
            cursor: pointer;
            background: transparent;
            color: ${textSecondary};

            &:hover {
                color: ${textPrimary};
            }
        `}

    ${({ disabled }) =>
        disabled &&
        css`
            cursor: not-allowed;
            color: ${textParagraph};
        `}

    // TODO: не то чтобы нравится это решение
    &:hover div {
        visibility: initial;
    }
`;

export const StyledItemText = styled.div`
    white-space: nowrap;
    user-select: none;

    ${h6 as CSSObject};
`;

export const StyledContentRight = styled.div`
    color: inherit;
    min-width: 0.75rem;
    min-height: 0.75rem;

    display: flex;
    align-items: center;
    justify-content: center;
`;

