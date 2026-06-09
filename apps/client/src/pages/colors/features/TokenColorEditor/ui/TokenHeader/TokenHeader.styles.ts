import styled from 'styled-components';

import { IconRotateCcw, IconTrashOutline } from '@salutejs/plasma-icons';

export const StyledHeader = styled.div`
    display: flex;
    flex-direction: column;

    margin-left: -0.375rem;

    gap: 0.25rem;
`;

export const StyledHeaderToken = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;

    height: 2rem;

    gap: 0.25rem;
`;

export const StyledHeaderTokenButtons = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;

    gap: 0.125rem;
`;

export const StyledDisplayNamePrefix = styled.span`
    color: var(--text-general-primary);
    white-space: nowrap;
    margin-right: -0.4375rem;
`;

export const StyledIconRotateCcw = styled(IconRotateCcw)`
    width: 0.875rem !important;
    height: 0.875rem !important;
`;

export const StyledIconTrashOutline = styled(IconTrashOutline)`
    width: 0.875rem !important;
    height: 0.875rem !important;
`;

export const StyledDeleteTooltipAnchor = styled.div`
    position: relative;
    display: inline-flex;

    &:hover > div:nth-child(2) {
        display: flex;
    }
`;
