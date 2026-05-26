import styled from 'styled-components';
import { GradientConstructor } from '../GradientConstructor';

export const Root = styled.div`
    display: flex;
    flex-direction: column;
`;

export const StyledTools = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;

    padding: 0.375rem 0;

    justify-content: space-between;

    border-top: var(--border-radius-xxxs) solid var(--outline-transparent-primary);
    border-bottom: var(--border-radius-xxxs) solid var(--outline-transparent-primary);
`;

export const StyledGradientConstructor = styled(GradientConstructor)`
    padding: 0.625rem;
`;
