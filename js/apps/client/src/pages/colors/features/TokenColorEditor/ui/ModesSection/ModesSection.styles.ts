import styled, { CSSObject } from 'styled-components';

import { h6 } from '../../../../../../utils';

export const StyledSubgroupWrapper = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
`;

export const StyledSubgroupHeader = styled.div`
    position: relative;
    user-select: none;
    cursor: pointer;

    display: flex;
    align-items: center;
    gap: 0.25rem;
`;

export const StyledSubgroupName = styled.div`
    font-size: 0.75rem;

    display: flex;
    justify-content: space-between;
    align-items: center;

    ${h6 as CSSObject};

    font-weight: 500;

    color: var(--text-general-primary);
`;

export const StyledSubgroups = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
`;
