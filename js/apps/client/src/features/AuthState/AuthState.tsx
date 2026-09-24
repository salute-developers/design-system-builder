import { ReactNode } from 'react';

import { Root, StyledActions, StyledDescription, StyledEyebrow, StyledHeader, StyledTitle } from './AuthState.styles';

interface AuthStateProps {
    eyebrow?: string;
    title: string;
    description?: string;
    actions: ReactNode;
}

export const AuthState = ({ eyebrow, title, description, actions }: AuthStateProps) => {
    return (
        <Root>
            <StyledHeader>
                {eyebrow && <StyledEyebrow>{eyebrow}</StyledEyebrow>}
                <StyledTitle>{title}</StyledTitle>
                {description && <StyledDescription>{description}</StyledDescription>}
            </StyledHeader>
            <StyledActions>{actions}</StyledActions>
        </Root>
    );
};
