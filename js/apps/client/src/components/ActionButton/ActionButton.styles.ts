import styled, { css, CSSObject } from 'styled-components';

import { h6 } from '../../utils';

export const Root = styled.button<{ view: 'primary' | 'secondary'; stretched?: boolean }>`
    position: relative;

    box-sizing: border-box;
    width: ${({ stretched }) => (stretched ? '100%' : 'fit-content')};
    padding: 0.25rem 0.375rem;

    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;

    border-radius: 0.375rem;
    border: 0.0625rem solid transparent;
    cursor: pointer;
    user-select: none;
    outline: none;

    ${h6 as CSSObject};
    font-family: inherit;

    transition:
        transform 0.1s ease-in-out,
        background 0.1s ease-in-out,
        border-color 0.1s ease-in-out;

    ${({ view }) =>
        view === 'primary' &&
        css`
            background: var(--surface-accent-primary);
            color: var(--on-dark-text-primary, #f3f3f3);
        `}

    ${({ view }) =>
        view === 'secondary' &&
        css`
            background: transparent;
            border-color: var(--outline-transparent-primary);
            color: var(--text-general-primary);

            &:hover:not(:disabled) {
                background: var(--surface-transparent-primary);
            }
        `}

    &:hover:not(:disabled) {
        transform: scale(1.02);
    }

    &:active:not(:disabled) {
        transform: scale(0.99);
    }

    &:focus-visible {
        outline: 0.0625rem solid var(--outline-accent-primary);
        outline-offset: 0.125rem;
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.4;
    }
`;

export const StyledContent = styled.span`
    display: inline-flex;
    align-items: center;
    justify-content: center;
`;
