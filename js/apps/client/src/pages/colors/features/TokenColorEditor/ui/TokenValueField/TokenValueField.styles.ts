import styled, { CSSObject } from 'styled-components';

import { h6 } from '../../../../../../utils';

export const StyledTextFieldGroup = styled.div`
    display: flex;
    align-items: center;

    & > *:nth-child(2) > div {
        border-right: none;
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
    }

    & > *:nth-child(3) > div {
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
    }

    &:focus-within > *:nth-child(2) > div,
    &:focus-within > *:nth-child(3) > div {
        border-color: var(--outline-accent-primary);
    }
`;

export const StyledTextFieldGroupLabel = styled.div`
    ${h6 as CSSObject};

    color: var(--text-general-tertiary);
    white-space: nowrap;
    min-width: 3rem;
`;

export const StyledColorItemPreview = styled.div<{ background: string }>`
    background: ${(props) => props.background};
    min-width: 1rem;
    min-height: 1rem;

    border-radius: 0.1875rem;

    box-sizing: border-box;
    box-shadow: 0 0 0 0.0625rem var(--outline-transparent-primary);
`;
