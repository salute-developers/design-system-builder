import styled, { CSSObject } from 'styled-components';
import {
    outlineSolidSecondary,
    surfaceSolidCard,
    textPrimary,
    textSecondary,
    textTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../../utils';

export const Root = styled.div``;

export const StyledLabel = styled.div`
    color: ${textTertiary};

    ${h6 as CSSObject};
`;

export const StyledItems = styled.div`
    margin-top: 0.75rem;

    display: flex;
    gap: 0.25rem;
    align-items: center;
`;

export const StyledItem = styled.div`
    cursor: pointer;

    padding: 0.75rem 1.25rem;

    ${h6 as CSSObject};

    border-radius: 1.25rem;

    background: transparent;
    color: ${textSecondary};
    box-shadow: 0 0 0 0.0625rem ${outlineSolidSecondary} inset;

    &:hover {
        background: ${surfaceSolidCard};
        color: ${textPrimary};
        box-shadow: none;
    }
`;

