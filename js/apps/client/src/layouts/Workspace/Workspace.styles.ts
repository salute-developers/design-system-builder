import styled from 'styled-components';

export const Menu = styled.div<{ background?: string }>`
    box-sizing: border-box;
    padding: 0 0.75rem;

    position: relative;
    z-index: 9999;

    min-width: 17.5rem;
    max-width: 17.5rem;
    height: 100%;

    border: 0.03125rem solid var(--inverse-outline-transparent-primary);
    border-top: none;
    border-bottom: none;

    background: ${({ background }) => background || 'transparent'};
`;

export const Content = styled.div`
    box-sizing: border-box;

    width: 100%;
    height: 100%;
    flex: 1;
    min-width: 0;
`;
