import { HTMLAttributes } from 'react';
import styled from 'styled-components';

const Root = styled.div<{ color?: string }>`
    cursor: pointer;
    width: fit-content;

    display: inline-flex;
    justify-content: center;
    align-items: center;

    padding: 1.125rem 1.5rem 1.125rem 1.75rem;
    gap: 0.625rem;

    border-radius: 2.5rem;
    background: ${({ color }) => color};
`;

const StyledText = styled.div`
    color: #fff;

    font-family: 'SB Sans Display';
    font-size: 16px;
    font-style: normal;
    font-weight: 400;
    line-height: 20px;
`;

const StyledContentRight = styled.div`
    display: inline-flex;
    justify-content: center;
    align-items: center;
`;

interface HeroButtonProps extends HTMLAttributes<HTMLDivElement> {
    text: string;
    color: string;
    contentRight?: React.ReactNode;
}

export const HeroButton = (props: HeroButtonProps) => {
    const { text, color, contentRight, ...rest } = props;

    return (
        <Root color={color} {...rest}>
            <StyledText>{text}</StyledText>
            <StyledContentRight>{contentRight}</StyledContentRight>
        </Root>
    );
};
