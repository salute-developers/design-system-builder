import styled from 'styled-components';
import { surfaceTransparentSecondary } from '@salutejs/plasma-themes/tokens/plasma_infra';

const Root = styled.div`
    background: ${surfaceTransparentSecondary};
    height: 0.125rem;
`;

const StyledProgress = styled.div<{ color: string; value: number }>`
    background: ${({ color }) => color};
    height: 0.125rem;
    width: ${({ value }) => value}%;

    transition: width 0.2s ease-in-out;
`;

interface LoadingProgressProps {
    value: number;
    color: string;
}

export const LoadingProgress = (props: LoadingProgressProps) => {
    const { value, color, ...rest } = props;

    return (
        <Root {...rest}>
            <StyledProgress color={color} value={value} />
        </Root>
    );
};
