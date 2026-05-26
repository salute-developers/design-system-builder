import styled, { css, CSSObject } from 'styled-components';
import { IconDone } from '@salutejs/plasma-icons';
import { surfaceTransparentPrimary, textPrimary, textSecondary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../../../../utils';

export const FilterPopupRoot = styled.div`
    display: flex;
    flex-direction: column;
    min-width: 12rem;
    padding: 0.25rem;
`;

export const FilterPopupSeparator = styled.div`
    height: 0.0625rem;
    margin: 0.25rem 0;
    background: var(--outline-transparent-primary);
`;

export const FilterPopupItem = styled.div<{ selected?: boolean; disabled?: boolean }>`
    display: flex !important;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    border-radius: 0.375rem;
    cursor: pointer;
    user-select: none;

    color: ${({ selected }) => (selected ? textPrimary : textSecondary)};

    ${h6 as CSSObject};

    &:hover {
        background: ${surfaceTransparentPrimary};
        color: ${textPrimary};
    }

    ${({ disabled }) =>
        disabled &&
        css`
            opacity: 0.4;
            cursor: default;
            pointer-events: none;
        `}
`;

export const FilterPopupItemCheck = styled.div`
    width: 0.75rem;
    height: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
`;

export const StyledIconDone = styled(IconDone)`
    --icon-size: 0.875rem !important;
`;

export const FilterPopupItemText = styled.span`
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;
