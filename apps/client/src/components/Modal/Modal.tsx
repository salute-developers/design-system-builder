import { useEffect } from 'react';
import { Wrapper } from './Modal.styles';
import { Root } from './Modal.styles';

interface ModalProps {
    opened: boolean;
    children: React.ReactNode;
    anchor?: HTMLElement;
    anchorOffsetX?: number;
    anchorOffsetY?: number;
    onClose: () => void;
}

export const Modal = (props: ModalProps) => {
    const { opened, children, anchor, anchorOffsetX, anchorOffsetY, onClose, ...rest } = props;

    const onDialogClick = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    useEffect(() => {
        if (!opened) {
            return;
        }

        document.addEventListener('click', onClose);

        return () => {
            document.removeEventListener('click', onClose);
        };
    }, [opened, onClose]);

    if (!opened) {
        return null;
    }

    const rootStyle = anchor
        ? {
              position: 'fixed' as const,
              top: anchor.getBoundingClientRect().top + (anchorOffsetY ?? 0),
              left: anchor.getBoundingClientRect().right + (anchorOffsetX ?? 0),
              transform: 'none',
          }
        : undefined;

    return (
        <Root style={rootStyle}>
            <Wrapper onClick={onDialogClick} {...rest}>
                {children}
            </Wrapper>
        </Root>
    );
};
