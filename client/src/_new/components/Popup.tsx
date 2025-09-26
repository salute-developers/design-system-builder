import styled from 'styled-components';
import { backgroundSecondary } from '@salutejs/plasma-themes/tokens/plasma_infra';

const Root = styled.div`
    position: absolute;
    inset: 0.125rem;

    overflow: hidden;

    background: ${backgroundSecondary};

    transition: background 0.2s ease-in-out;
`;

interface PopupProps {
    children: React.ReactNode;
}

export const Popup = (props: PopupProps) => {
    const { children, ...rest } = props;

    return <Root {...rest}>{children}</Root>;
};
