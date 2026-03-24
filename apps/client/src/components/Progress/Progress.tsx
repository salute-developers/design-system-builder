import { Root, StyledProgress } from './Progress.styles';

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

