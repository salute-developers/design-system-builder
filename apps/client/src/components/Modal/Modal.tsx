import { Fragment } from 'react';

import { Dialog, DialogActions, DialogTitle } from './Modal.styles';
import { Root } from './Modal.styles';

interface ModalProps {
    title?: string;
    children: React.ReactNode;
    actions: React.ReactNode[];
    onClickOutside?: () => void;
}

export const Modal = (props: ModalProps) => {
    const { title, children, actions, onClickOutside, ...rest } = props;

    const onDialogClick = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    return (
        <Root onClick={onClickOutside} {...rest}>
            <Dialog onClick={onDialogClick}>
                <DialogTitle>{title}</DialogTitle>
                {children}
                <DialogActions>
                    {actions.map((action, index) => (
                        <Fragment key={index}>{action}</Fragment>
                    ))}
                </DialogActions>
            </Dialog>
        </Root>
    );
};
