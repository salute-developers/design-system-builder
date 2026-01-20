import styled, { css, CSSObject } from 'styled-components';
import {
    surfaceTransparentPrimary,
    textParagraph,
    textPrimary,
    textSecondary,
    textTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../../utils';

export const Root = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
`;

export const Header = styled.div`
    padding: 0 0.5rem;
    box-sizing: border-box;
    height: 2.5rem;

    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
`;

export const HeaderTitle = styled.div`
    overflow: hidden;
    color: ${textPrimary};
    text-overflow: ellipsis;

    ${h6 as CSSObject};
    font-weight: 600;
`;

export const List = styled.div`
    display: flex;
    flex-direction: column;
`;

export const MenuSection = styled.div`
    padding: 0 0.5rem;
    box-sizing: border-box;
    height: 2rem;

    color: ${textTertiary};

    display: flex;
    flex-direction: row;
    align-items: center;

    ${h6 as CSSObject};
`;

export const ListItem = styled.div<{ selected?: boolean }>`
    cursor: pointer;

    margin: 0.25rem 0;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;

    color: ${textSecondary};

    ${({ selected }) =>
        selected &&
        css`
            cursor: default;
            color: ${textPrimary};
            background: ${surfaceTransparentPrimary};
        `}

    display: flex;
    gap: 0.75rem;
    align-items: center;
    align-self: stretch;
`;

export const ListItemText = styled.span`
    color: inherit;

    &:hover {
        color: ${textPrimary};
    }

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;

    ${h6 as CSSObject};
`;

export const ListItemContentRight = styled.div`
    cursor: pointer;

    color: ${textParagraph};

    &:hover {
        color: ${textPrimary};
    }

    display: flex;
    align-items: center;
    align-self: stretch;
`;
