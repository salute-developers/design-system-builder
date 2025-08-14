import styled, { css } from 'styled-components';

export const Root = styled.div<{ selected?: boolean }>`
    border-radius: 50%;

    display: flex;
    align-items: center;

    width: 1rem;
    height: 1rem;

    background: var(--gray-color-300);
    color: var(--gray-color-900);

    ${({ selected }) =>
        !selected &&
        css`
            cursor: pointer;
            background: transparent;
            color: var(--gray-color-500);

            &:hover {
                color: var(--gray-color-150);
            }
        `}
`;

interface IconButtonProps {
    selected?: boolean;
    children: React.ReactNode;
    style?: React.CSSProperties;
    onClick?: () => void;
}

export const IconButton = (props: IconButtonProps) => {
    const { children, selected, ...rest } = props;

    return (
        <Root selected={selected} {...rest}>
            {children}
        </Root>
    );
};
