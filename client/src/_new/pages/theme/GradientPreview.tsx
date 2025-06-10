import React from 'react';
import styled from 'styled-components';
import { IconButton } from '@salutejs/plasma-b2c';
import { IconTrashOutline } from '@salutejs/plasma-icons';

import { GradientToken } from '../../../themeBuilder';

const StyledColor = styled.div<{ value: string }>`
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
    margin-right: 10rem;
    background: ${({ value }) => value};
    box-shadow: rgba(8, 8, 8, 0.12) 0px 0px 0px 1px inset;
`;

const StyledRGBAValue = styled.div`
    min-width: 17rem;
    margin-right: 10rem;
`;

const StyledHEXAValue = styled.div``;

const StyledDeleteTokenButton = styled(IconButton)`
    margin-left: auto;
`;

export const GradientPreview = ({
    token,
    onTokenDelete,
}: {
    token: GradientToken;
    onTokenDelete?: (token: GradientToken) => void;
}) => {
    const value = token.getValue('web');
    const newValue = value.join(', ');

    const onClick = (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
        event.stopPropagation();

        if (onTokenDelete) {
            onTokenDelete(token);
        }
    };

    return (
        <>
            <StyledColor value={newValue} />
            <StyledRGBAValue>rgba(255, 255, 255, 0)</StyledRGBAValue>
            <StyledHEXAValue>#FFFFFFFF</StyledHEXAValue>
            <StyledDeleteTokenButton view="clear" onClick={onClick}>
                <IconTrashOutline />
            </StyledDeleteTokenButton>
        </>
    );
};
