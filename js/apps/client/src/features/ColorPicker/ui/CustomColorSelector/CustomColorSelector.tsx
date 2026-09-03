import { useState } from 'react';

import { SegmentButton, SegmentButtonItem } from '../../../../components';

import { Root, StyledGradientConstructor, StyledTools } from './CustomColorSelector.styles';
import { getStyleList, platformTypeList } from './CustomColorSelector.utils';

import { ColorConstructor } from '../';
import { VariationType } from '../../../../controllers';

interface CustomColorSelectorProps {
    tokenType: VariationType;
    color: string;
    opacity: number;
    onColorChange?: (color: string | string[]) => void;
    onOpacityChange?: (opacity: number) => void;
}

export const CustomColorSelector = (props: CustomColorSelectorProps) => {
    const { tokenType, color, opacity, onColorChange, onOpacityChange } = props;

    const styleTypeList = getStyleList(tokenType);
    const defaultStyleType = tokenType === 'color' ? styleTypeList[0] : styleTypeList[1];
    const [styleType, setStyleType] = useState<SegmentButtonItem>(defaultStyleType);

    const onColorValueChange = (value: string) => {
        onColorChange?.(value);
    };

    const onGradientChange = (value: string | string[]) => {
        onColorChange?.(value);
    };

    const onSliderValueChange = (opacity: number) => {
        onOpacityChange?.(opacity / 100);
    };

    const onStyleTypeSelect = (item: SegmentButtonItem) => {
        setStyleType(item);
    };

    return (
        <Root>
            <StyledTools>
                <SegmentButton items={styleTypeList} selected={styleType} onSelect={onStyleTypeSelect} />
                <SegmentButton items={platformTypeList} selected={platformTypeList[0]} />
            </StyledTools>
            {styleType.value === 'fill' && (
                <ColorConstructor
                    color={color}
                    opacity={opacity}
                    onChange={onColorValueChange}
                    onOpacityChange={onSliderValueChange}
                />
            )}
            {styleType.value === 'gradient' && (
                <StyledGradientConstructor color={color} onColorChange={onGradientChange} />
            )}
        </Root>
    );
};
