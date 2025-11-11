import { ReactNode } from 'react';
import styled, { CSSObject } from 'styled-components';
import { textParagraph, textPrimary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../utils';

const StyledResetTokeValuesButton = styled.div`
    cursor: pointer;
    color: ${textParagraph};

    &:hover {
        color: ${textPrimary};
    }

    display: flex;
    gap: 0.375rem;
    align-items: center;

    ${h6 as CSSObject};
`;

interface LinkButtonProps {
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
