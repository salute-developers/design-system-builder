import styled from 'styled-components';

export const Root = styled.div`
    height: 100%;
    background: transparent;

    display: flex;
`;

export const StyledSetup = styled.div`
    box-sizing: border-box;
    padding: 0.75rem 1.25rem;

    min-width: 33.75rem;
    height: 100%;
    min-height: 0;

    border-right: 0.03125rem solid var(--inverse-outline-transparent-primary);

    display: flex;
    flex-direction: column;
    gap: 0.75rem;
`;

export const StyledHeader = styled.div`
    display: flex;
    flex-direction: column;

    margin-left: -0.375rem;
`;

export const StyledWrapper = styled.div`
    flex: 1;
    min-height: 0;

    display: flex;
    gap: 1.5rem;
    margin-left: -0.5rem;
`;
