import styled from 'styled-components';

export const Wrapper = styled.div`
    box-sizing: border-box;
    width: 100%;
    height: 100vh;

    display: grid;
    grid-template-columns: 1fr 1fr;

    @media (max-width: 960px) {
        grid-template-columns: 1fr;
    }
`;

export const StyledPreviewColumn = styled.div`
    min-width: 0;
    min-height: 0;

    @media (max-width: 960px) {
        display: none;
    }
`;

export const StyledFormColumn = styled.div`
    box-sizing: border-box;
    min-width: 0;
    padding: 2rem 1rem;
    overflow: auto;

    display: flex;
    align-items: center;
    justify-content: center;
`;
