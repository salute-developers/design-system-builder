import styled, { CSSObject } from 'styled-components';
import { textParagraph, textPrimary, textTertiary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../../utils';

export const Root = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
`;

export const StyledLabel = styled.div`
    color: ${textTertiary};

    ${h6 as CSSObject};
`;

export const StyledCommand = styled.div`
    box-sizing: border-box;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;

    display: flex;
    align-items: center;
    gap: 0.75rem;

    background: var(--surface-transparent-secondary);
    color: ${textPrimary};
`;

export const StyledCommandText = styled.code`
    flex: 1;
    min-width: 0;

    font-family: 'SB Mono', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    line-height: 16px;
    white-space: nowrap;
    user-select: all;
`;

export const StyledCopyButton = styled.div`
    cursor: pointer;
    flex-shrink: 0;

    display: flex;
    align-items: center;
    gap: 0.375rem;

    color: ${textParagraph};

    &:hover {
        color: ${textPrimary};
    }

    ${h6 as CSSObject};
`;
