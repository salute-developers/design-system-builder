import styled from 'styled-components';

const Root = styled.div`
    position: absolute;
    inset: 0.125rem;

    overflow: hidden;

    background: var(--gray-color-950);

    transition: background 0.2s ease-in-out;
`;

interface PopupProps {
    children: React.ReactNode;
}

export const Popup = (props: PopupProps) => {
    const { children, ...rest } = props;

    return <Root {...rest}>{children}</Root>;
};
