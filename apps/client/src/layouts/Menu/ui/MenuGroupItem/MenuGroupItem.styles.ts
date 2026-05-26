import styled, { CSSObject } from 'styled-components';
import { IconChevronDown, IconChevronRight } from '@salutejs/plasma-icons';

import { h6 } from '../../../../utils';

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
    top: 0.75rem;
    cursor: pointer;
`;

export const ListItems = styled.div``;

export const ListGroupTitle = styled.span`
    user-select: none;
    min-width: 0;

    color: var(--text-general-primary);

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    ${h6 as CSSObject};

    font-weight: 500;
`;

export const ListItemChangedIndicator = styled.div<{ canShowTooltip?: boolean }>`
    display: flex;
    align-items: center;

    width: 0.25rem;
    height: 0.25rem;
    border-radius: 50%;

    // TODO: Поменять на токен Surfaces/Default/Accent/Solid/Accent
    background: rgba(63, 129, 253, 1);
`;

export const StyledIconChevronRight = styled(IconChevronRight)`
    --icon-size: 0.5rem !important;
`;

export const StyledIconChevronDown = styled(IconChevronDown)`
    --icon-size: 0.5rem !important;
`;
