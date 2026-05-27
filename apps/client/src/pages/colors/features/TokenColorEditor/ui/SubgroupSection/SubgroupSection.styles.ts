import styled, { CSSObject } from 'styled-components';

import { h6 } from '../../../../../../utils';

export const StyledSubgroup = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
`;

export const StyledSubgroupLabel = styled.div`
    font-size: 0.75rem;

    display: flex;
    justify-content: space-between;
    align-items: center;

    ${h6 as CSSObject};

    color: var(--text-general-tertiary);
`;

export const StyledLinkTooltipAnchor = styled.div`
    position: relative;
    display: inline-flex;

    &:hover > div:nth-child(2) {
        display: flex;
    }
`;
