import { useEffect, useMemo, useState } from 'react';

import { SelectButton, SelectButtonItem, Slider, TextField } from '../../components';
import { getNormalizedColor, isValidColorValue } from '../../utils';

import { Root } from './ColorPicker.styles';
import { paletteList } from './ColorPicker.utils';

import { CustomColorSelector, PaletteColorSelector } from './ui';

interface ColorPickerProps {
    color: string;
    opacity?: number;
    onColorChange?: (color: string) => void;
    onOpacityChange?: (opacity: number) => void;
}

export const ColorPicker = (props: ColorPickerProps) => {
    const { color, opacity, onColorChange, onOpacityChange } = props;

    const [colorValueStatus, setColorValueStatus] = useState<'default' | 'negative'>('default');
    const [palette, setPalette] = useState({
        value: 'corp',
    });

    const [inputValue, setInputValue] = useState(getNormalizedColor(color, undefined, true));

    // const colorValue = useMemo(() => getNormalizedColor(color, undefined, true), [color]);

    const onPaletteSelect = (item: SelectButtonItem) => {
        setPalette(item);
    };

    const onSliderValueChange = (opacity: number) => {
        if (onOpacityChange) {
            onOpacityChange(opacity / 100);
        }
    };

    const onColorValueChange = (value: string) => {
        if (onColorChange) {
            onColorChange(value);
            setColorValueStatus('default');
        }
    };

    const onInputValueChange = (value: string) => {
        setColorValueStatus('default');

        setInputValue(value);
    };

    const onInputValueBlur = (event: React.FocusEvent<HTMLInputElement>) => {
        const value = event.target.value;

        if (!onColorChange) {
            return;
        }

        if (isValidColorValue(value)) {
            onColorChange(value);
            return;
        }

        if (value === '') {
            setInputValue(getNormalizedColor(color, undefined, true));
            return;
        }

        setColorValueStatus('negative');
    };

    useEffect(() => {
        setInputValue(getNormalizedColor(color, undefined, true));
    }, [color]);

    useEffect(() => {
        const currentPalette = color.startsWith('general.') ? 'corp' : 'custom';

        setPalette({ value: currentPalette });
    }, [color]);

    return (
        <Root>
            <SelectButton label="Палитра" items={paletteList} selected={palette} onItemSelect={onPaletteSelect} />
            {palette.value === 'corp' && (
                <PaletteColorSelector color={color} opacity={opacity} onChange={onColorValueChange} />
            )}
            {palette.value === 'custom' && <CustomColorSelector color={color} onChange={onColorValueChange} />}
            <div style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem', width: '100%', alignItems: 'center' }}>
                {palette.value === 'custom' && (
                    <TextField
                        value={inputValue}
                        stretched
                        onChange={onInputValueChange}
                        onBlur={onInputValueBlur}
                        view={colorValueStatus}
                    />
                )}
                <Slider
                    color={color}
                    value={Number(((opacity ?? 1) * 100).toFixed(0))}
                    onChange={onSliderValueChange}
                />
            </div>
        </Root>
    );
};
