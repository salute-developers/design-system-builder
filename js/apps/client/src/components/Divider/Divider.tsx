import { HTMLAttributes, ReactNode } from 'react';

import { Root, StyledLine, StyledText } from './Divider.styles';

interface DividerProps extends HTMLAttributes<HTMLDivElement> {
    children?: ReactNode;
}

export const Divider = ({ children, ...rest }: DividerProps) => {
    return (
        <Root role="separator" {...rest}>
            <StyledLine />
            {children && (
                <>
                    <StyledText>{children}</StyledText>
                    <StyledLine />
                </>
            )}
        </Root>
    );
};
