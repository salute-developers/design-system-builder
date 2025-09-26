import styled, { css } from 'styled-components';
import {
    inverseTextPrimary,
    surfaceSolidDefault,
    textParagraph,
    textPrimary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

export const Root = styled.div<{ selected?: boolean }>`
    border-radius: 50%;

    display: flex;
    align-items: center;

    width: 1rem;
    height: 1rem;

    background: ${surfaceSolidDefault};
    color: ${inverseTextPrimary};

    ${({ selected }) =>
        !selected &&
        css`
            cursor: pointer;
            background: transparent;
            color: ${textParagraph};

            &:hover {
                color: ${textPrimary};
            }
        `}
`;

interface IconButtonProps {
    selected?: boolean;
    children: React.ReactNode;
    style?: React.CSSProperties;
    onClick?: () => void;
}

export const IconButton = (props: IconButtonProps) => {
    const { children, selected, ...rest } = props;

    return (
        <Root selected={selected} {...rest}>
            {children}
        </Root>
    );
};
