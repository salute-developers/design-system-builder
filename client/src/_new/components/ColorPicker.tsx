import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { general } from '@salutejs/plasma-colors';

import { SelectButton, SelectButtonItem } from './SelectButton';
import { Slider } from './Slider';
import { getCorpColor, prettifyColorName, separatedCorpColor } from '../utils';

const Root = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
`;

const ColorPreview = styled.div`
    position: relative;
    height: 10rem;
    width: 100%;

    border-radius: 1.25rem;

    --sq: 1.25rem;
    --c1: rgba(36, 36, 43, 1);
    --c2: rgba(46, 47, 53, 1);

    background-color: var(--c1);
    background-image: linear-gradient(45deg, var(--c2) 25%, transparent 25%, transparent 75%, var(--c2) 75%, var(--c2)),
        linear-gradient(45deg, var(--c2) 25%, transparent 25%, transparent 75%, var(--c2) 75%, var(--c2));
    background-position: 0 0, var(--sq) var(--sq);
    background-size: calc(var(--sq) * 2) calc(var(--sq) * 2);
`;

const ColorPreviewBackground = styled.div<{ color: string; opacity?: number }>`
    border-radius: 1.25rem;

    background: ${({ color }) => color};
    opacity: ${({ opacity }) => opacity};

    position: absolute;
    inset: 0;

    // TODO: Заменить на токен
    box-shadow: 0 0 0 0.0625rem rgba(247, 248, 251, 0.04) inset;

    transition: background 0.25s linear;
`;

const ColorSelector = styled.div`
    display: flex;
    gap: 0.375rem;
    align-items: center;

    position: absolute;
    left: 1.25rem;
    bottom: 1.125rem;
`;

const accentColors = Object.entries(general).map(([name]) => ({
    label: prettifyColorName(name),
    value: name,
}));

const saturationColors = Object.keys(general.amber).map((name) => ({
    label: name,
    value: name,
}));

const paletteList = [
    {
        label: 'Корпоративная',
        value: 'corp',
    },
    {
        label: 'Кастомная',
        value: 'custom',
        disabled: true,
    },
];

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
