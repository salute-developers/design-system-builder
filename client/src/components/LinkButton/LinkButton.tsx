import { HTMLAttributes, ReactNode } from 'react';

import { StyledResetTokeValuesButton } from './LinkButton.styles';

interface LinkButtonProps extends HTMLAttributes<HTMLDivElement> {
    text: string;
    contentLeft?: ReactNode;
    contentRight?: ReactNode;
    onClick?: () => void;
}

export const LinkButton = (props: LinkButtonProps) => {
    const { text, contentLeft, contentRight, onClick, ...rest } = props;

    return (
        <StyledResetTokeValuesButton onClick={onClick} {...rest}>
            {contentLeft}
            <>{text}</>
            {contentRight}
        </StyledResetTokeValuesButton>
    );
};

