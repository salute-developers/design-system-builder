import styled from 'styled-components';
import {
    backgroundSecondary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

export const Root = styled.div<{ background?: string }>`
    position: relative;

    width: 100%;
    height: 100%;
    background: ${({ background }) => background || backgroundSecondary};
`;

export const StyledPreviewShape = styled.div`
    padding: 0.75rem;
    box-sizing: border-box;

    display: grid;
    grid-template-rows: 60% 30% 10%;
    gap: 0.25rem;

    height: 100%;
`;

export const StyledPreviewShapeItem = styled.div<{ borderRadius: string }>`
    width: 100%;
    height: 100%;
    border-radius: ${({ borderRadius }) => borderRadius}px;

    // TODO: использовать токен
    background: #32353e;

    transition: border-radius 0.2s ease-in-out;
`;

export const StyledPreviewShadow = styled.div`
    position: relative;

    padding: 0.75rem;
    box-sizing: border-box;

    height: 100%;
`;

export const StyledPreviewShadowBackgroundEditor = styled.div`
    position: absolute;

    top: 0.75rem;
    left: 0.75rem;

    display: flex;
    flex-direction: column;
    gap: 0.5rem;
`;

export const StyledPreviewShadowSizeEditor = styled.div`
    position: absolute;

    bottom: 0.75rem;
    left: 0.75rem;
`;

export const StyledPreviewShadowItem = styled.div<{ width: string; height: string; boxShadow: string }>`
    background: #ffffff;

    width: ${({ width }) => width}px;
    height: ${({ height }) => height}px;

    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    border-radius: 2rem;

    box-shadow: ${({ boxShadow }) => boxShadow};

    transition: box-shadow 0.2s ease-in-out, width 0.2s ease-in-out, height 0.2s ease-in-out;
`;

export const StyledPreviewSpacing = styled.div<{ spacing: string }>`
    padding: calc(0.75rem + ${({ spacing }) => spacing}px);

    box-sizing: border-box;

    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
    gap: ${({ spacing }) => spacing}px;

    height: 100%;

    transition: gap 0.2s ease-in-out, padding 0.2s ease-in-out;
`;

export const StyledPreviewSpacingItem = styled.div<{ spacing: string }>`
    width: 100%;
    height: 100%;
    border-radius: 0.25rem;

    // TODO: использовать токен
    background: #32353e;
`;
