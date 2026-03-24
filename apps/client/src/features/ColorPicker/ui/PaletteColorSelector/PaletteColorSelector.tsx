import { useEffect, useState } from 'react';
import { general } from '@salutejs/plasma-colors/dist/general';

import { SelectButton, SelectButtonItem } from '../../../../components';
import { getCorpColor, prettifyColorName, separatedCorpColor } from '../../../../utils';

import { Root, ColorPreviewBackground, ColorSelector } from './PaletteColorSelector.styles';
import { accentColors, saturationColors } from './PaletteColorSelector.utils';

interface PaletteColorSelectorProps {
    color: string;
    opacity?: number;
    onChange?: (color: string) => void;
}

export const PaletteColorSelector = (props: PaletteColorSelectorProps) => {
    const { color, opacity, onChange } = props;

    const [innerColor, setInnerColor] = useState(color);
    const [, accentValue, saturationValue] = separatedCorpColor(innerColor);

    const [accent, setAccent] = useState<SelectButtonItem>({
        label: prettifyColorName(accentValue),
        value: accentValue,
    });

    const [saturation, setSaturation] = useState<SelectButtonItem>({
        label: saturationValue,
        value: saturationValue,
    });

    const onAccentSelect = (item: SelectButtonItem) => {
        setAccent(item);

        if (onChange) {
            onChange(getCorpColor(item.value, saturation.value));
        }
    };

    const onAccentHover = (item: SelectButtonItem) => {
        const value = getCorpColor(item.value, saturation.value);

        setInnerColor(value);
    };

    const onSaturationSelect = (item: SelectButtonItem) => {
        setSaturation(item);

        if (onChange) {
            onChange(getCorpColor(accent.value, item.value));
        }
    };

    const onSaturationHover = (item: SelectButtonItem) => {
        const value = getCorpColor(accent.value, item.value);

        setInnerColor(value);
    };

    const onOutsideClick = () => {
        setInnerColor(color);
    };

    useEffect(() => {
        setInnerColor(color);

        const [, accentValue, saturationValue] = separatedCorpColor(color);
        setAccent({ label: prettifyColorName(accentValue), value: accentValue });
        setSaturation({ label: saturationValue, value: saturationValue });
    }, [color]);

    const resultColor = (general as any)[accentValue]?.[saturationValue] ?? innerColor;

    return (
        <Root>
            <ColorPreviewBackground
                style={{
                    background: resultColor,
                    opacity,
                }}
            />
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
        </Root>
    );
};
