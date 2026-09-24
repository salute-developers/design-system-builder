import styled, { CSSObject } from 'styled-components';
import { bodyS } from '@salutejs/plasma-themes/tokens/plasma_infra';

export const Root = styled.div`
    box-sizing: border-box;
    width: 18.75rem;

    display: flex;
    flex-direction: column;
    gap: 1.5rem;
`;

export const StyledHeader = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;

    text-align: center;
    word-break: break-word;
`;

export const StyledEyebrow = styled.div`
    font-size: 0.75rem;
    line-height: 1rem;
    font-weight: 600;

    color: var(--text-general-tertiary);
`;

export const StyledTitle = styled.h1`
    margin: 0;

    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.875rem;

    color: var(--text-general-primary);
`;

export const StyledDescription = styled.p`
    margin: 0;

    ${bodyS as CSSObject};

    color: var(--text-general-tertiary);
`;

export const StyledActions = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
`;
