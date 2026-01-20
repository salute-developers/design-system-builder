import { Root } from './Popup.styles';

interface PopupProps {
    children: React.ReactNode;
}

export const Popup = (props: PopupProps) => {
    const { children, ...rest } = props;

    return <Root {...rest}>{children}</Root>;
};

