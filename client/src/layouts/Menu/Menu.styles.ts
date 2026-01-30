import styled, { css, CSSObject } from 'styled-components';
import { IconChevronDown, IconChevronUp } from '@salutejs/plasma-icons';
import {
    bodyXXS,
    outlineTransparentPrimary,
    surfaceTransparentPrimary,
    textPrimary,
    textSecondary,
    textTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../../utils';

export const Root = styled.div`
    height: 100%;

    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    &:hover > div:nth-child(2) > div > div > div:nth-child(1),
    &:hover > div:nth-child(3) > div > div > div:nth-child(1) {
        display: block;
    }
`;

export const Header = styled.div`
    padding: 0 0.5rem;
    box-sizing: border-box;

    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
`;

export const HeaderContent = styled.div``;

export const HeaderTitle = styled.div`
    margin-top: 0.25rem;
    overflow: hidden;
    text-overflow: ellipsis;

    color: ${textPrimary};
    ${h6 as CSSObject};
    font-weight: 600;
`;

export const HeaderSubtitle = styled.div`
    margin-top: 0.25rem;
    overflow: hidden;
    text-overflow: ellipsis;

    color: ${textTertiary};
    ${h6 as CSSObject};
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

export const ListSectionGroups = styled.div`
    display: flex;
    flex-direction: column;

    padding-left: 0.75rem;
    margin-left: -0.75rem;

    overflow-y: scroll;
    overflow-x: visible;
`;

export const ListSectionGroup = styled.div`
    position: relative;

    display: flex;
    flex-direction: column;
`;

export const ListSectionGroupToggle = styled.div`
    display: none;

    position: absolute;
    left: 0;
    transform: translateX(-0.5rem);
    top: 0.25rem;
    cursor: pointer;
`;

export const ListItems = styled.div`
    max-height: 32rem;
    overflow-y: scroll;
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
            color: ${textTertiary};

            & > div:nth-child(2) {
                display: flex;
            }

            & > div:nth-child(2) div {
                color: inherit;
            }

            &:hover > div:nth-child(2) div {
                color: ${textPrimary};
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

export const ListItemWrapper = styled.div<{ canShowTooltip?: boolean }>`
    display: flex;
    gap: 0.375rem;
    align-items: center;
    padding-right: 0.0625rem;

    overflow: hidden;

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

    color: inherit;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    ${h6 as CSSObject};
`;

export const ListItemPreviewWrapper = styled.div`
    display: none;
    align-items: center;
    gap: 0.25rem;
`;

export const ListItemColorPreview = styled.div`
    box-shadow: 0 0 0 0.0625rem ${outlineTransparentPrimary};

    height: 0.75rem;
    width: 0.75rem;
    border-radius: 50%;
`;

export const ListItemTypographyPreview = styled.div`
    color: ${textTertiary};

    ${bodyXXS as CSSObject};
`;

export const ListItemShapePreview = styled.div`
    color: ${textTertiary};

    ${bodyXXS as CSSObject};

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

export const ListItemContentRight = styled.div`
    display: none;

    align-items: center;
    align-self: stretch;
    gap: 0.5rem;
`;

export const StyledIconChevronDown = styled(IconChevronDown)`
    --icon-size: 0.5rem !important;
`;

export const StyledIconChevronUp = styled(IconChevronUp)`
    --icon-size: 0.5rem !important;
`;
