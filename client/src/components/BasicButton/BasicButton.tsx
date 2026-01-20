import { HTMLAttributes, ReactNode } from 'react';

import { checkIsColorContrast } from '../../utils';
import { Root, StyledContentRight, StyledText } from './BasicButton.styles';

interface BasicButtonProps extends HTMLAttributes<HTMLDivElement> {
    text: string;
    size?: 'l' | 'm';
    backgroundColor?: string;
    contentRight?: ReactNode;
}

export const BasicButton = (props: BasicButtonProps) => {
    // INFO: backgroundColor = surfaceSolidCard
    const { text, size = 'm', backgroundColor = '#4B4C58', contentRight, ...rest } = props;

    const color = checkIsColorContrast(backgroundColor, '#FFFFFF') ? '#FFFFFF' : '#000000';

    return (
        <Root backgroundColor={backgroundColor} color={color} size={size} {...rest}>
            <StyledText>{text}</StyledText>
            {contentRight && <StyledContentRight>{contentRight}</StyledContentRight>}
        </Root>
    );
};
