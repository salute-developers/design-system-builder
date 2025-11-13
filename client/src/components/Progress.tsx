import styled from 'styled-components';
import { surfaceTransparentSecondary, textPrimary } from '@salutejs/plasma-themes/tokens/plasma_infra';

const Root = styled.div`
    background: ${surfaceTransparentSecondary};
    height: 0.125rem;
    overflow: hidden;
    width: 100%;
`;

const StyledProgress = styled.div<{ color?: string; value: number }>`
    background: ${({ color }) => color || textPrimary};
    height: 0.125rem;
    width: ${({ value }) => value}%;

    transition: width 0.2s ease-in-out;
`;

interface ProgressProps {
    value: number;
    color?: string;
}

export const Progress = (props: ProgressProps) => {
    const { value, color, ...rest } = props;

    return (
        <Root {...rest}>
            <StyledProgress color={color} value={value} />
        </Root>
    );
};
