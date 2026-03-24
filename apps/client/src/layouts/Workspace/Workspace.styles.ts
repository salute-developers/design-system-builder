import styled from 'styled-components';

export const Menu = styled.div<{ background?: string }>`
    box-sizing: border-box;
    padding: 0.75rem;
    padding-bottom: 0;
    min-width: 15rem;
    max-width: 15rem;
    height: 100vh;

    background: ${({ background }) => background || 'transparent'};
`;

export const Content = styled.div`
    box-sizing: border-box;

    width: 100%;
    height: 100vh;
`;
