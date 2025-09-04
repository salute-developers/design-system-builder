import { useRef, useState } from 'react';
import styled from 'styled-components';
import { ThemeMode } from '@salutejs/plasma-tokens-utils';
import { IconInfoCircleOutline } from '@salutejs/plasma-icons';
import { ContrastRatioChecker } from 'contrast-ratio-checker';
import { checkIsColorContrast } from '../utils';

const Root = styled.div`
    position: relative;
`;

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

    min-width: 3rem;
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

const StyledDescription = styled.div`
    position: absolute;
    bottom: -3rem;

    width: 8rem;

    display: flex;
    gap: 0.25rem;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    text-align: center;
    font-family: 'SB Sans Display';
    font-size: 10px;
    font-style: normal;
    font-weight: 400;
    line-height: 12px;

    transition: left 0.1s ease-out;
`;

const StyledDescriptionPointer = styled.div`
    height: 1rem;
    width: 0.063rem;

    background-image: linear-gradient(to bottom, var(--gray-color-150) 0%, rgba(236, 236, 236, 0) 100%);
`;

const StyledDescriptionHelper = styled.div`
    display: flex;
    align-items: center;
    gap: 0.25rem;
`;

const StyledDescriptionStroke = styled.div<{ color: string }>`
    color: ${({ color }) => color};

    white-space: nowrap;

    padding: 0.25rem 0;
`;

const StyledDescriptionFill = styled.div<{ backgroundColor: string; color: string }>`
    color: ${({ color }) => color};
    background: ${({ backgroundColor }) => backgroundColor};

    white-space: nowrap;

    padding: 0.0625rem 0.25rem 0.1875rem 0.25rem;
    border-radius: 0.25rem;
`;

const StyledDescriptionWarning = styled.div`
    display: flex;
    gap: 0.125rem;
    align-items: center;

    color: var(--gray-color-500);
`;

const StyledDescriptionWarningWCAG = styled.div`
    font-family: 'SB Sans Display';
    font-size: 10px;
    font-style: normal;
    font-weight: 400;
    line-height: 12px;
`;

const StyledIconInfoCircleOutline = styled(IconInfoCircleOutline)`
    --icon-size: 0.75rem !important;
`;

interface SaturationSelectProps {
    label: string;
    items: {
        value: string;
        color: string;
    }[];
    themeMode: ThemeMode;
    saturationType: 'fill' | 'stroke';
    onSelect?: (value: string) => void;
}

export const SaturationSelect = (props: SaturationSelectProps) => {
    const { items, label, themeMode, saturationType, onSelect, ...rest } = props;

    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [hoveredColor, setHoveredColor] = useState<string>('');
    const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const backgroundColor = themeMode === 'light' ? '#FFFFFF' : '#000000';
    const threshold = saturationType === 'stroke' ? 3 : 2;
    const isColorContrast = checkIsColorContrast(hoveredColor, backgroundColor, threshold);
    const contrastColor = checkIsColorContrast(hoveredColor, '#FFFFFF') ? '#FFFFFF' : '#000000'; // TODO: сделать переменными 100 / 950

    const currentItem = hoveredIndex !== null && itemRefs?.current[hoveredIndex];
    const descriptionLeftOffset = currentItem ? currentItem.offsetLeft - 128 / 2 + 48 / 2 : 0;

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
                            onMouseEnter={() => {
                                setHoveredColor(color);
                                setHoveredIndex(index);
                            }}
                            onMouseLeave={() => {
                                setHoveredColor('');
                                setHoveredIndex(null);
                            }}
                            onClick={() => onClick(value)}
                            ref={(el) => {
                                itemRefs.current[index] = el;
                            }}
                        >
                            <StyledSaturation size={size} color={color} />
                            <StyledItemLabel color={labelColor}>{value}</StyledItemLabel>
                        </StyledItem>
                    );
                })}
            </StyledItems>
            {hoveredIndex !== null && (
                <StyledDescription
                    style={{
                        left: `${descriptionLeftOffset}px`,
                    }}
                >
                    <StyledDescriptionPointer />
                    <StyledDescriptionHelper>
                        {saturationType === 'stroke' && (
                            <StyledDescriptionStroke color={hoveredColor}>для текста и ссылок</StyledDescriptionStroke>
                        )}
                        {saturationType === 'fill' && (
                            <StyledDescriptionFill color={contrastColor} backgroundColor={hoveredColor}>
                                для контролов и плашек
                            </StyledDescriptionFill>
                        )}
                        {!isColorContrast && (
                            <StyledDescriptionWarning>
                                <StyledIconInfoCircleOutline color="inherit" />
                                <StyledDescriptionWarningWCAG>WCAG</StyledDescriptionWarningWCAG>
                            </StyledDescriptionWarning>
                        )}
                    </StyledDescriptionHelper>
                </StyledDescription>
            )}
        </Root>
    );
};
