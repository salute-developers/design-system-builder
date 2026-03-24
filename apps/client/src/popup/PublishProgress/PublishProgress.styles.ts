import styled, { CSSObject } from 'styled-components';
import { h1, textPrimary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../../utils';
import { Progress } from '../../components';

export const Root = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    height: 100%;
`;

export const StyledDesignSystemName = styled.div`
    position: absolute;
    left: 0.75rem;
    top: 0.75rem;

    display: flex;
    align-items: center;
    width: 16rem;
    height: 2.5rem;
    padding: 0 0.5rem;

    color: ${textPrimary};

    ${h6 as CSSObject};
    font-weight: 600;
`;

export const StyledDescription = styled.div`
    position: absolute;
    width: 17.5rem;
    left: 50%;
    transform: translateX(-50%) translateY(-1.875rem);

    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.75rem;
`;

export const StyledStatus = styled.div`
    color: ${textPrimary};
    ${h6 as CSSObject};
`;

export const StyledVersion = styled.div`
    color: ${textPrimary};
    ${h1 as CSSObject};
`;

export const StyledProgress = styled(Progress)``;
