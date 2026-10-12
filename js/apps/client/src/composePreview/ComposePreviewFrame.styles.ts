import styled from 'styled-components';

export const FrameRoot = styled.div`
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 20.75rem;
`;

export const PreviewIframe = styled.iframe`
    display: block;
    width: 100%;
    height: 100%;
    min-height: 20.75rem;
    border: 0;
    border-radius: inherit;
    background: transparent;
`;

export const Status = styled.div`
    position: absolute;
    left: 0.75rem;
    bottom: 0.75rem;
    z-index: 1;
    max-width: calc(100% - 1.5rem);
    padding: 0.375rem 0.625rem;
    border-radius: 0.5rem;
    color: #ffffff;
    background: rgb(0 0 0 / 70%);
    font-size: 0.75rem;
`;
