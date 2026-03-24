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
    background: ${({ background }) => background};
    border-radius: 1.25rem;

    flex: 1;
    height: 20.75rem;
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
`;

export const StyledComponentControls = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    width: fit-content;
`;

export const StyledDivider = styled.div`
    margin: 0.75rem 0;
`;
