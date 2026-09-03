import styled, { css, CSSObject } from 'styled-components';
import { bodyXXS, textPrimary, textSecondary, textTertiary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../../../../utils';

export const ListItem = styled.div<{ selected?: boolean; disabled?: boolean }>`
    position: relative;
    cursor: pointer;

    margin: 0.25rem 0;
    padding: 0.25rem;
    border-radius: 0.375rem;

    color: ${textSecondary};

    ${({ selected, disabled }) =>
        selected &&
        !disabled &&
        css`
            cursor: default;
            color: ${textPrimary};
            background: var(--surface-transparent-primary);
        `}

    ${({ disabled }) =>
        disabled &&
        css`
            opacity: 0.4;

            & > div:nth-child(2) {
                display: flex;
            }

            &:hover > div:nth-child(2) div {
                color: ${textPrimary};
            }
        `}

    ${({ disabled }) =>
        !disabled &&
        css`
            &:hover > div > div {
                display: flex;
            }
        `}


    &:hover {
        color: ${textPrimary};
    }

    &:hover > div:nth-child(2) {
        display: flex;
    }

    display: flex;
    gap: 1.5rem;
    align-items: center;
    align-self: stretch;
    justify-content: space-between;
`;

export const ListItemWrapper = styled.div<{ canShowTooltip?: boolean }>`
    display: flex;
    gap: 0.375rem;
    align-items: center;
    padding-right: 0.0625rem;
    min-width: 0;

    ${({ canShowTooltip }) =>
        canShowTooltip &&
        css`
            &:hover ~ div:nth-child(3) {
                display: flex;
            }
        `}
`;

export const ListItemText = styled.span`
    user-select: none;
    min-width: 0;

    color: inherit;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    ${h6 as CSSObject};
`;

export const ListItemPreviewWrapper = styled.div<{ changed?: boolean }>`
    display: flex;
    align-items: center;
    flex-direction: column;

    min-width: 1rem;
    min-height: 1rem;
    flex: none;

    border-radius: 0.25rem;
    box-sizing: border-box;
    border: 0.0625rem solid var(--outline-transparent-primary);
    overflow: hidden;

    ${({ changed }) =>
        changed &&
        css`
            box-shadow: 0 0 0 0.0625rem rgba(255, 255, 255, 0.4);
        `}
`;

export const ListItemColorPreview = styled.div`
    height: 0.5rem;
    width: 1rem;
`;

export const ListItemTypographyPreview = styled.div`
    color: ${textTertiary};

    ${bodyXXS as CSSObject};
`;

export const ListItemContentRight = styled.div`
    display: none;

    align-items: center;
    align-self: stretch;
    gap: 0.5rem;
`;
