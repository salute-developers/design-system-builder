import styled from 'styled-components';

import { IconChevronDown } from '@salutejs/plasma-icons';
import { IconChevronRight, IconInfoCircleOutline } from '@salutejs/plasma-icons';

import { IconButton } from '../../../../../../components';

export const StyledSubgroupToggle = styled(IconButton)`
    position: absolute;
    left: -0.75rem;
`;

export const StyledSubgroupInfo = styled.div`
    position: relative;
    display: inline-flex;

    &:hover > div:nth-child(2) {
        display: flex;
    }
`;

export const StyledIconChevronRight = styled(IconChevronRight)`
    width: 0.5rem !important;
    height: 0.5rem !important;
`;

export const StyledIconChevronDown = styled(IconChevronDown)`
    width: 0.5rem !important;
    height: 0.5rem !important;
`;

export const StyledIconInfoCircleOutline = styled(IconInfoCircleOutline)`
    width: 0.875rem !important;
    height: 0.875rem !important;
`;
