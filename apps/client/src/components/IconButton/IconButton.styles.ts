import styled, { css } from 'styled-components';
import { textParagraph, textPrimary } from '@salutejs/plasma-themes/tokens/plasma_infra';

export const Root = styled.div<{ selected?: boolean; disabled?: boolean; size?: 's' | 'm' }>`
    border-radius: 0.5rem;

    display: flex;
    align-items: center;

    width: 1rem;
    height: 1rem;

    background: var(--surface-transparent-secondary);
    color: var(--text-general-primary);

    ${({ selected }) =>
        !selected &&
        css`
            cursor: pointer;
            background: transparent;
            color: ${textParagraph};

            &:hover {
                color: ${textPrimary};
            }
        `}

    ${({ disabled }) =>
        disabled &&
        css`
            cursor: not-allowed;
            opacity: 0.4;

            &:hover {
                color: ${textParagraph};
            }
        `}
`;
