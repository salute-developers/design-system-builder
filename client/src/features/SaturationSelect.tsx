import { useRef, useState } from 'react';
import styled, { CSSObject } from 'styled-components';
import { ThemeMode } from '@salutejs/plasma-tokens-utils';
import { IconInfoCircleOutline } from '@salutejs/plasma-icons';
import { bodyXXS, textParagraph, textPrimary, textTertiary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { SaturationType } from '../types';
import { checkIsColorContrast, h6 } from '../utils';

const Root = styled.div`
    position: relative;
`;

const StyledLabel = styled.div`
    color: ${textTertiary};

    ${h6 as CSSObject};
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
    ${bodyXXS as CSSObject};

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

const StyledDescription = styled.div<{ left: number }>`
    position: absolute;
    bottom: -3rem;
    left: ${({ left }) => left}px;

    width: 8rem;

    display: flex;
    gap: 0.25rem;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    text-align: center;
    ${bodyXXS as CSSObject};

    transition: left 0.1s ease-out;
`;

const StyledDescriptionPointer = styled.div`
    height: 1rem;
    width: 0.063rem;

    background-image: linear-gradient(to bottom, ${textPrimary} 0%, rgba(236, 236, 236, 0) 100%);
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

    color: ${textParagraph};
`;

const StyledDescriptionWarningWCAG = styled.div`
    ${bodyXXS as CSSObject};
`;

const StyledIconInfoCircleOutline = styled(IconInfoCircleOutline)`
    --icon-size: 0.75rem !important;
`;

const DESCRIPTION_WIDTH = 128;
const DEFAULT_COLOR_SATURATION_SIZE = 40;
const HOVERED_COLOR_SATURATION_SIZE = 48;
const HOVERED_COLOR_SATURATION_SIBLING_SIZE = 36;
const HOVERED_COLOR_SATURATION_REST_SIZE = 32;

const getItemSizeAndColor = (hoveredIndex: number | null, index: number): [number, string] => {
    if (hoveredIndex === index) {
        return [HOVERED_COLOR_SATURATION_SIZE, textPrimary];
    }

    if (hoveredIndex === index - 1 || hoveredIndex === index + 1) {
        return [HOVERED_COLOR_SATURATION_SIBLING_SIZE, textParagraph];
    }

    if (hoveredIndex === null) {
        return [DEFAULT_COLOR_SATURATION_SIZE, textPrimary];
    }

    return [HOVERED_COLOR_SATURATION_REST_SIZE, textTertiary];
};

interface SaturationSelectProps {
    label: string;
    items: {
        value: string;
        color: string;
    }[];
    themeMode: ThemeMode;
    saturationType: SaturationType;
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

    const contrastColor = checkIsColorContrast(hoveredColor, '#FFFFFF', 3) ? '#FFFFFF' : '#000000';
    const currentItem = hoveredIndex !== null && itemRefs?.current[hoveredIndex];
    const descriptionLeftOffset = currentItem
        ? currentItem.offsetLeft - DESCRIPTION_WIDTH / 2 + HOVERED_COLOR_SATURATION_SIZE / 2
        : 0;

    const onClick = (value: string) => {
        if (onSelect) {
            onSelect(value);
        }
    };

    const handleItemMouseEnter = (color: string, index: number) => {
        setHoveredColor(color);
        setHoveredIndex(index);
    };

    const handleItemMouseLeave = () => {
        setHoveredColor('');
        setHoveredIndex(null);
    };

    const handleItemClick = (value: string) => {
        onClick(value);
    };

    return (
        <Root {...rest}>
            <StyledLabel>{label}</StyledLabel>
            <StyledItems>
                {items.map(({ value, color }, index) => {
                    const [size, labelColor] = getItemSizeAndColor(hoveredIndex, index);

                    return (
                        <StyledItem
                            key={value}
                            onMouseEnter={() => handleItemMouseEnter(color, index)}
                            onMouseLeave={handleItemMouseLeave}
                            onClick={() => handleItemClick(value)}
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
                <StyledDescription left={descriptionLeftOffset}>
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
