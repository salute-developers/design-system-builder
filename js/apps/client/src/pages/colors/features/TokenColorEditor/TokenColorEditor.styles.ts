import styled from 'styled-components';

export const Root = styled.div`
    height: 100%;

    background: transparent;

    display: flex;
`;

export const StyledSetup = styled.div`
    box-sizing: border-box;
    padding: 0.5rem 1rem;

    border-right: 0.03125rem solid var(--inverse-outline-transparent-primary);

    min-width: 20rem;

    display: flex;
    flex-direction: column;
    gap: 1.25rem;
`;
