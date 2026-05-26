import { HTMLAttributes, ReactNode } from 'react';

import { Root, StyledContentRight, StyledText } from './BasicButton.styles';

interface BasicButtonProps extends HTMLAttributes<HTMLDivElement> {
    text: string;
    size?: 'l' | 'm';
    backgroundColor?: string;
    textColor?: string;
    contentRight?: ReactNode;
}

export const BasicButton = (props: BasicButtonProps) => {
    const { text, size = 'm', backgroundColor, textColor, contentRight, ...rest } = props;

    return (
        <Root backgroundColor={backgroundColor} textColor={textColor} size={size} {...rest}>
            <StyledText>{text}</StyledText>
            {contentRight && <StyledContentRight>{contentRight}</StyledContentRight>}
        </Root>
    );
};
