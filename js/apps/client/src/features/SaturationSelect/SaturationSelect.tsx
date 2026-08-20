import { useRef, useState } from 'react';
import { ThemeMode } from '@salutejs/plasma-tokens-utils';

import { SaturationType } from '../../types';
import { checkIsColorContrast } from '../../utils';
import {
    Root,
    StyledLabel,
    StyledItems,
    StyledItem,
    StyledItemLabel,
    StyledSaturation,
    StyledDescription,
    StyledDescriptionPointer,
    StyledDescriptionHelper,
    StyledDescriptionStroke,
    StyledDescriptionFill,
    StyledDescriptionWarning,
    StyledDescriptionWarningWCAG,
    StyledIconInfoCircleOutline,
} from './SaturationSelect.styles';
import { DESCRIPTION_WIDTH, getItemSizeAndColor, HOVERED_COLOR_SATURATION_SIZE } from './SaturationSelect.utils';

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
