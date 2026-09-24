import { ButtonHTMLAttributes, ReactNode } from 'react';

import { Root, StyledContent } from './ActionButton.styles';

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    text: string;
    view?: 'primary' | 'secondary';
    stretched?: boolean;
    contentLeft?: ReactNode;
    contentRight?: ReactNode;
}

export const ActionButton = (props: ActionButtonProps) => {
    const { text, view = 'primary', stretched = false, contentLeft, contentRight, type = 'button', ...rest } = props;

    return (
        <Root view={view} stretched={stretched} type={type} {...rest}>
            {contentLeft && <StyledContent>{contentLeft}</StyledContent>}
            {text}
            {contentRight && <StyledContent>{contentRight}</StyledContent>}
        </Root>
    );
};
