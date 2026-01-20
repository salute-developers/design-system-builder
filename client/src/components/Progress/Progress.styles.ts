import styled from 'styled-components';
import { surfaceTransparentSecondary, textPrimary } from '@salutejs/plasma-themes/tokens/plasma_infra';

export const Root = styled.div`
    background: ${surfaceTransparentSecondary};
    height: 0.125rem;
    overflow: hidden;
    width: 100%;
`;

export const StyledProgress = styled.div<{ color?: string; value: number }>`
    background: ${({ color }) => color || textPrimary};
    height: 0.125rem;
    width: ${({ value }) => value}%;

    transition: width 0.2s ease-in-out;
`;

