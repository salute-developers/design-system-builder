import styled, { CSSObject } from 'styled-components';
import { bodyXS, textNegative } from '@salutejs/plasma-themes/tokens/plasma_infra';

export const Root = styled.div<{ view: 'default' | 'negative' }>`
    --form-field-border-color: ${({ view }) =>
        view === 'negative' ? textNegative : 'var(--outline-transparent-secondary)'};
    --form-field-helper-color: ${({ view }) => (view === 'negative' ? textNegative : 'var(--text-general-tertiary)')};

    display: flex;
    flex-direction: column;
    gap: 0.25rem;

    width: 100%;
    min-width: 0;

    ${bodyXS as CSSObject};
`;

export const StyledLabel = styled.label`
    color: var(--text-general-tertiary);
`;

export const StyledWrapper = styled.div`
    position: relative;

    box-sizing: border-box;
    width: 100%;
    height: 1.5rem;
    padding: 0 0.375rem 0 0.375rem;

    display: flex;
    align-items: center;
    gap: 0.25rem;

    border-radius: 0.375rem;
    border: 0.0625rem solid var(--form-field-border-color);
    background: var(--surface-transparent-primary);

    transition:
        border-color 0.1s ease-in-out,
        background 0.1s ease-in-out;

    &:hover {
        background: var(--surface-transparent-secondary);
    }

    &:focus-within {
        border-color: var(--outline-accent-primary);
        background: var(--surface-transparent-secondary);
    }
`;

export const StyledInput = styled.input`
    flex: 1;
    min-width: 0;

    padding: 0;
    border: 0;
    outline: none;
    background: transparent;

    color: var(--text-general-primary);
    caret-color: var(--text-general-primary);
    font: inherit;
    letter-spacing: inherit;

    ::placeholder {
        color: var(--text-general-tertiary);
    }
`;

export const StyledContentRight = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;

    flex-shrink: 0;
    color: var(--text-general-tertiary);
`;

export const StyledHelper = styled.div`
    color: var(--form-field-helper-color);
`;
