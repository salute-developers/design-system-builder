import { HTMLAttributes } from 'react';
import styled from 'styled-components';
import { checkIsColorContrast } from '../utils';

const Root = styled.div<{ backgroundColor?: string; color?: string }>`
    position: relative;
    z-index: 999;

    cursor: pointer;
    width: fit-content;

    display: inline-flex;
    justify-content: center;
    align-items: center;

    padding: 1.125rem 1.5rem 1.125rem 1.75rem;
    gap: 0.625rem;

    border-radius: 2.5rem;
    background: ${({ backgroundColor }) => backgroundColor};
    color: ${({ color }) => color};

    transition: transform 0.1s ease-in-out;

    :hover {
        transform: scale(1.02);
    }

    :active {
        transform: scale(0.99);
    }
`;

const StyledText = styled.div`
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
    backgroundColor?: string;
    contentRight?: React.ReactNode;
}

export const HeroButton = (props: HeroButtonProps) => {
    const { text, backgroundColor = '#000000', contentRight, ...rest } = props;

    const color = checkIsColorContrast(backgroundColor, '#FFFFFF') ? '#FFFFFF' : '#000000';

    return (
        <Root backgroundColor={backgroundColor} color={color} {...rest}>
            <StyledText>{text}</StyledText>
            <StyledContentRight>{contentRight}</StyledContentRight>
        </Root>
    );
};
