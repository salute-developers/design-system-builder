import { MouseEvent } from 'react';

import { Root } from './IconButton.styles';

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

