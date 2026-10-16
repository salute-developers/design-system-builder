import styled from 'styled-components';
import { textSecondary } from '@salutejs/plasma-themes/tokens/plasma_infra';

export const Root = styled.div`
    position: absolute;
    z-index: 10000;
    bottom: 1rem;
    left: 4.5rem;

    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 13.5rem;
`;

export const StyledMessage = styled.div`
    color: ${textSecondary};
    font-size: 0.75rem;
    line-height: 1rem;
    word-break: break-word;
`;
