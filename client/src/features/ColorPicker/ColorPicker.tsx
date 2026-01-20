import { useEffect, useState } from 'react';
import { general } from '@salutejs/plasma-colors';

import { SelectButton, SelectButtonItem, Slider } from '../../components';
import { getCorpColor, prettifyColorName, separatedCorpColor } from '../../utils';
import { Root, ColorPreview, ColorPreviewBackground, ColorSelector } from './ColorPicker.styles';
import { accentColors, paletteList, saturationColors } from './ColorPicker.utils';

interface ColorPickerProps {
    color: string;
    opacity?: number;
    onColorChange?: (color: string) => void;
    onOpacityChange?: (opacity: number) => void;
}

export const ColorPicker = (props: ColorPickerProps) => {
    const { color: outerColor, opacity, onColorChange, onOpacityChange } = props;

    const [palette, setPalette] = useState({
        value: 'corp',
    });

    const [innerColor, setInnerColor] = useState(outerColor);
    const [, accentValue, saturationValue] = separatedCorpColor(innerColor);

    const [accent, setAccent] = useState<SelectButtonItem>({
        label: prettifyColorName(accentValue),
        value: accentValue,
    });

    const [saturation, setSaturation] = useState<SelectButtonItem>({
        label: saturationValue,
        value: saturationValue,
    });

    const onPaletteSelect = (item: SelectButtonItem) => {
        setPalette(item);
    };

    const onAccentSelect = (item: SelectButtonItem) => {
        setAccent(item);

        if (onColorChange) {
            onColorChange(getCorpColor(item.value, saturation.value));
        }
    };

    const onAccentHover = (item: SelectButtonItem) => {
        const value = getCorpColor(item.value, saturation.value);

        setInnerColor(value);
    };

    const onSaturationSelect = (item: SelectButtonItem) => {
        setSaturation(item);

        if (onColorChange) {
            onColorChange(getCorpColor(accent.value, item.value));
        }
    };

    const onSaturationHover = (item: SelectButtonItem) => {
        const value = getCorpColor(accent.value, item.value);

        setInnerColor(value);
    };

    const onOutsideClick = () => {
        setInnerColor(outerColor);
    };

    const onSliderValueChange = (opacity: number) => {
        if (onOpacityChange) {
            onOpacityChange(opacity / 100);
        }
    };

    useEffect(() => {
        setInnerColor(outerColor);

        const [, accentValue, saturationValue] = separatedCorpColor(outerColor);
        setAccent({ label: prettifyColorName(accentValue), value: accentValue });
        setSaturation({ label: saturationValue, value: saturationValue });
    }, [outerColor]);

    const resultColor = (general as any)[accentValue]?.[saturationValue] ?? innerColor;

    return (
        <Root>
            <SelectButton label="Палитра" items={paletteList} selected={palette} onItemSelect={onPaletteSelect} />
            <ColorPreview>
                <ColorPreviewBackground color={resultColor} opacity={opacity} />
                <ColorSelector>
                    <SelectButton
                        items={accentColors}
                        selected={accent}
                        onBackgroundColor={resultColor}
                        onItemSelect={onAccentSelect}
                        onItemHover={onAccentHover}
                        onOutsideClick={onOutsideClick}
                    />
                    <SelectButton
                        items={saturationColors}
                        selected={saturation}
                        onBackgroundColor={resultColor}
                        onItemSelect={onSaturationSelect}
                        onItemHover={onSaturationHover}
                        onOutsideClick={onOutsideClick}
                    />
                </ColorSelector>
            </ColorPreview>
            <Slider
                color={resultColor}
                value={Number(((opacity ?? 1) * 100).toFixed(0))}
                onChange={onSliderValueChange}
            />
        </Root>
    );
};
