import styled from 'styled-components';
import { backgroundSecondary } from '@salutejs/plasma-themes/tokens/plasma_infra';

export const Root = styled.div<{ background?: string }>`
    position: relative;

    width: 100%;
    height: 100%;
    background: ${backgroundSecondary};
`;

export const StyledPreviewShadow = styled.div`
    position: relative;

    padding: 0.75rem;
    box-sizing: border-box;

    width: 100%;
    height: 100%;

    display: flex;
    flex-direction: column;
    gap: 1.25rem;
`;

export const StyledPreviewBackgroundEditor = styled.div`
    position: relative;

    display: flex;
    flex-direction: column;
    gap: 0.5rem;
`;

export const StyledComponentWrapper = styled.div<{ background: string }>`
    position: relative;

    background: ${({ background }) => background};
    border-radius: 1.25rem;

    flex: none;
    height: 30rem;
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
`;

export const StyledStorySelector = styled.div`
    position: absolute;
    left: 0.75rem;
    bottom: 0.75rem;
`;

export const StyledComponentControls = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    width: 100%;

    flex: 1;
    min-height: 0;
    overflow-y: auto;
`;

export const StyledDivider = styled.div`
    margin: 0.75rem 0;
`;
