import { MouseEvent } from 'react';
import styled, { css } from 'styled-components';
import {
    inverseTextPrimary,
    surfaceSolidDefault,
    textParagraph,
    textPrimary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

export const Root = styled.div<{ selected?: boolean; disabled?: boolean }>`
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

    ${({ disabled }) =>
        disabled &&
        css`
            cursor: not-allowed;
            opacity: 0.4;

            &:hover {
                color: ${textParagraph};
            }
        `}
`;

interface IconButtonProps {
    selected?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    style?: React.CSSProperties;
    onClick?: (event: MouseEvent<HTMLDivElement>) => void;
}

export const IconButton = (props: IconButtonProps) => {
    const { children, selected, disabled, onClick, ...rest } = props;

    const onButtonClick = (event: MouseEvent<HTMLDivElement>) => {
        if (onClick && !disabled) {
            onClick(event);
        }
    };

    return (
        <Root selected={selected} onClick={onButtonClick} disabled={disabled} {...rest}>
            {children}
        </Root>
    );
};
