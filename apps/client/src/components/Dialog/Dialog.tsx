import { Fragment } from 'react';

import { StyledActions, StyledModal, StyledHeader, StyledIconButton, StyledContent } from './Dialog.styles';
import { IconClose } from '@salutejs/plasma-icons/scalable/Icons/IconClose';

interface DialogProps {
    title?: string;
    opened: boolean;
    anchor?: HTMLElement;
    anchorOffsetX?: number;
    anchorOffsetY?: number;
    children: React.ReactNode;
    actions: React.ReactNode[];
    onClose: () => void;
}

export const Dialog = (props: DialogProps) => {
    const { opened, title, children, actions, anchor, anchorOffsetX, anchorOffsetY, onClose, ...rest } = props;

    return (
        <StyledModal
            opened={opened}
            anchor={anchor}
            anchorOffsetX={anchorOffsetX}
            anchorOffsetY={anchorOffsetY}
            onClose={onClose}
            {...rest}
        >
            <StyledHeader>
                {title}
                <StyledIconButton onClick={onClose}>
                    <IconClose size="xs" color="inherit" />
                </StyledIconButton>
            </StyledHeader>
            <StyledContent>{children}</StyledContent>
            <StyledActions>
                {actions.map((action, index) => (
                    <Fragment key={index}>{action}</Fragment>
                ))}
            </StyledActions>
        </StyledModal>
    );
};
