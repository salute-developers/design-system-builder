import styled from 'styled-components';
import { textParagraph, textPrimary } from '@salutejs/plasma-themes/tokens/plasma_infra';

export const Root = styled.button`
    flex: none;

    display: flex;
    align-items: center;
    justify-content: center;

    width: 2rem;
    height: 2rem;
    padding: 0;

    border: none;
    border-radius: 0.5rem;
    background: transparent;
    color: ${textParagraph};

    cursor: pointer;

    &:hover {
        color: ${textPrimary};
        background: var(--surface-transparent-secondary);
    }

    &:focus-visible {
        outline: 2px solid var(--outline-accent, currentColor);
        outline-offset: 1px;
    }
`;
