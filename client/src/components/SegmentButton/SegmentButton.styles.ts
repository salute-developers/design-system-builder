import styled, { css, CSSObject } from 'styled-components';
import {
    surfaceTransparentSecondary,
    textPrimary,
    textSecondary,
    textTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../../utils';
import { ViewType } from '../../types';

export const Root = styled.div<{ view?: ViewType }>`
    position: relative;
    cursor: default;

    height: 1.5rem;
    width: fit-content;

    display: flex;
    gap: 0.375rem;
    align-items: center;

    &:hover > div {
        color: ${textPrimary};
    }
`;

export const StyledLabel = styled.div`
    color: ${textTertiary};

    ${h6 as CSSObject};
`;

export const StyledWrapper = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

export const StyledItem = styled.div<{ selected?: boolean }>`
    color: ${textPrimary};

    background: ${({ selected }) => (selected ? surfaceTransparentSecondary : 'transparent')};
    padding: 0.25rem 0.375rem;
    border-radius: 0.375rem;

    ${({ selected }) =>
        !selected &&
        css`
            cursor: pointer;
            background: transparent;
            color: ${textSecondary};

            &:hover {
                color: ${textPrimary};
            }
        `}

    ${h6 as CSSObject};
`;

