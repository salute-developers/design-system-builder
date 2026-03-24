import styled, { css, CSSObject } from 'styled-components';
import {
    surfaceTransparentPrimary,
    textPrimary,
    textSecondary,
    textTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../../../../utils';
import { Dropdown } from '../../../../components';

export const Root = styled.div`
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 0.75rem;

    min-width: 11rem;
    max-width: 11rem;
`;

export const List = styled.div`
    display: flex;
    flex-direction: column;
`;

export const ListSectionTitle = styled.div`
    padding: 0 0.5rem;
    box-sizing: border-box;
    min-height: 2rem;

    color: ${textTertiary};

    display: flex;
    flex-direction: row;
    align-items: center;

    ${h6 as CSSObject};
`;

export const ListItem = styled.div<{ selected?: boolean; disabled?: boolean; lineThrough?: boolean }>`
    position: relative;
    cursor: pointer;

    margin: 0.25rem 0;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;

    color: ${textSecondary};

    ${({ selected, disabled }) =>
        selected &&
        !disabled &&
        css`
            cursor: default;
            color: ${textPrimary};
            background: ${surfaceTransparentPrimary};
        `}

    ${({ disabled, lineThrough }) =>
        disabled &&
        css`
            text-decoration: ${lineThrough ? 'line-through' : 'none'};
            cursor: not-allowed;
            color: ${textTertiary};

            & > div:nth-child(2) {
                display: flex;
            }

            & > div:nth-child(2) div {
                color: inherit;

                &:hover {
                    color: ${textPrimary};
                }
            }
        `}

    ${({ disabled }) =>
        !disabled &&
        css`
            &:hover {
                color: ${textPrimary};
            }

            &:hover > div > div {
                display: flex;
            }
        `}




    &:hover > div:nth-child(2) {
        display: flex;
    }

    display: flex;
    gap: 0.75rem;
    align-items: center;
    align-self: stretch;
    justify-content: space-between;
`;

export const ListItemWrapper = styled.div`
    display: flex;
    gap: 0.375rem;
    align-items: center;
    justify-content: space-between;

    overflow: hidden;

    &:hover div {
        display: flex;
    }
`;

export const ListItemText = styled.span`
    user-select: none;

    color: inherit;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    ${h6 as CSSObject};
`;

export const ListItemOption = styled.span`
    color: ${textTertiary};
    user-select: none;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    ${h6 as CSSObject};
`;

export const ListItemContentRight = styled.div`
    display: none;
    align-items: center;
    align-self: stretch;
    gap: 0.5rem;
`;

export const StyledDropdown = styled(Dropdown)`
    position: absolute;
    top: 0;
    left: calc(100% - 2rem);
`;
