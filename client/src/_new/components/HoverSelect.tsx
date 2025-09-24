import { HTMLAttributes } from 'react';
import styled from 'styled-components';

const Root = styled.div``;

const StyledLabel = styled.div`
    color: var(--gray-color-800);

    font-family: 'SB Sans Display';
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 16px;
`;

const StyledItems = styled.div`
    margin-top: 0.75rem;

    display: flex;
    gap: 0.25rem;
    align-items: center;
`;

const StyledItem = styled.div`
    cursor: pointer;

    padding: 0.75rem 1.25rem;

    font-family: 'SB Sans Display';
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 16px;

    border-radius: 1.25rem;

    background: transparent;
    color: var(--gray-color-300);
    box-shadow: 0 0 0 0.0625rem var(--gray-color-800) inset;

    &:hover {
        background: var(--gray-color-850);
        color: var(--gray-color-150);
        box-shadow: none;
    }
`;

interface HoverSelectProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
    label: string;
    grayTone?: string;
    items: {
        value: string;
        label: string;
    }[];
    onHover?: (value: string) => void;
    onSelect?: (value: string) => void;
}

export const HoverSelect = (props: HoverSelectProps) => {
    const { items, label, grayTone, onSelect, onHover, ...rest } = props;

    const onClick = (value: string) => {
        if (onSelect) {
            onSelect(value);
        }
    };

    return (
        <Root {...rest}>
            <StyledLabel>{label}</StyledLabel>
            <StyledItems>
                {items.map(({ label, value }) => (
                    <StyledItem
                        key={value}
                        onClick={() => onClick(value)}
                        onMouseEnter={() => onHover?.(value)}
                        onMouseLeave={() => onHover?.(grayTone || 'warmGray')}
                    >
                        {label}
                    </StyledItem>
                ))}
            </StyledItems>
        </Root>
    );
};
