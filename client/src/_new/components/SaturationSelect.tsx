import { useState } from 'react';
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
    align-items: center;
`;

const StyledItem = styled.div`
    cursor: pointer;

    width: 3rem;
    height: 4rem;

    display: flex;
    gap: 0.25rem;
    flex-direction: column;
    align-items: center;
    justify-content: center;
`;

const StyledItemLabel = styled.div<{ color: string }>`
    color: ${({ color }) => color};

    text-align: center;
    font-family: 'SB Sans Display';
    font-size: 10px;
    font-style: normal;
    font-weight: 400;
    line-height: 12px;

    transition: all 0.1s ease-out;
`;

const StyledSaturation = styled.div<{ color: string; size: number }>`
    background: ${({ color }) => color};

    box-shadow: 0 0 0 0.0625rem rgba(0, 0, 0, 0.12) inset;

    border-radius: 50%;

    width: ${({ size }) => size}px;
    height: ${({ size }) => size}px;

    transition: all 0.1s ease-out;
`;

interface SaturationSelectProps {
    label: string;
    items: {
        value: string;
        color: string;
    }[];
    onSelect?: (value: string) => void;
}

export const SaturationSelect = (props: SaturationSelectProps) => {
    const { items, label, onSelect, ...rest } = props;

    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    const onClick = (value: string) => {
        if (onSelect) {
            onSelect(value);
        }
    };

    return (
        <Root {...rest}>
            <StyledLabel>{label}</StyledLabel>
            <StyledItems>
                {items.map(({ value, color }, index) => {
                    let size = 32;
                    let labelColor = 'var(--gray-color-800)';

                    if (hoveredIndex === index) {
                        size = 48;
                        labelColor = 'var(--gray-color-150)';
                    }

                    if (hoveredIndex === index - 1 || hoveredIndex === index + 1) {
                        size = 36;
                        labelColor = 'var(--gray-color-500)';
                    }

                    if (hoveredIndex === null) {
                        size = 40;
                        labelColor = 'var(--gray-color-150)';
                    }

                    return (
                        <StyledItem
                            key={value}
                            onMouseEnter={() => setHoveredIndex(index)}
                            onMouseLeave={() => setHoveredIndex(null)}
                            onClick={() => onClick(value)}
                        >
                            <StyledSaturation size={size} color={color} />
                            <StyledItemLabel color={labelColor}>{value}</StyledItemLabel>
                        </StyledItem>
                    );
                })}
            </StyledItems>
        </Root>
    );
};
