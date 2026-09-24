import styled, { CSSObject } from 'styled-components';
import { bodyXS } from '@salutejs/plasma-themes/tokens/plasma_infra';

export const Root = styled.div`
    width: 100%;

    display: flex;
    align-items: center;
    gap: 0.5rem;

    padding: 0.5rem 0;
`;

export const StyledLine = styled.div`
    flex: 1;
    min-width: 0.125rem;
    height: 0.03125rem;

    background: var(--outline-transparent-primary);
`;

export const StyledText = styled.div`
    ${bodyXS as CSSObject};

    color: var(--text-general-tertiary);
    text-align: center;
    white-space: nowrap;
`;
