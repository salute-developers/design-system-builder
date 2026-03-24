import { useState } from 'react';
import { IconPlus, IconTrashOutline } from '@salutejs/plasma-icons';

import { getCorpColor, numberFormatter, prettifyColorName, separatedCorpColor } from '../../utils';
import { Slider, LinkButton, TextField, SelectButton, SelectButtonItem } from '../../components';
import {
    Root,
    StyledLayer,
    StyledLayerHeader,
    StyledIconButton,
    StyledLayerName,
    StyledShadowParams,
    StyledRowParams,
    StyledIconCharX,
    StyledIconCharY,
    StyledIconCardsGridFill,
    StyledIconBrightness1Outline,
} from './ShadowPicker.styles';
import {
    accentColors,
    colorFormatList,
    DEFAULT_CORP_COLOR,
    DEFAULT_CUSTOM_COLOR,
    paletteList,
    saturationColors,
} from './ShadowPicker.utils';

interface ComponentProps {
    value: ShadowType;
    index: number;
    onChange: (value: ShadowType, index: number) => void;
    onDelete: (index: number) => void;
}

const Component = (props: ComponentProps) => {
    const { value, index, onChange, onDelete } = props;

    const [, accentValue, saturationValue] = separatedCorpColor(value.color);

    const [palette, setPalette] = useState({
        value: value.color.startsWith('general') ? 'corp' : 'custom',
    });

    const [accent, setAccent] = useState<SelectButtonItem>({
        label: prettifyColorName(accentValue),
        value: accentValue,
    });

    const [saturation, setSaturation] = useState<SelectButtonItem>({
        label: saturationValue,
        value: saturationValue,
    });

    const onValueChange = (name: keyof ShadowType) => (newValue: string) => {
        const prevValue = (value[name] || '').toString();
        const formattedValue = numberFormatter(newValue, prevValue);

        if (!formattedValue) {
            return;
        }

        onChange(
            {
                ...value,
                [name]: formattedValue,
            },
            index,
        );
    };

    const onPaletteSelect = (item: SelectButtonItem) => {
        setPalette(item);

        if (item.value === 'custom') {
            onChange({ ...value, color: DEFAULT_CUSTOM_COLOR }, index);
        }

        if (item.value === 'corp') {
            const [, accentValue, saturationValue] = separatedCorpColor(DEFAULT_CORP_COLOR);
            onAccentSelect({ label: accentValue, value: accentValue });
            onSaturationSelect({ label: saturationValue, value: saturationValue });

            onChange({ ...value, color: DEFAULT_CORP_COLOR }, index);
        }
    };

    const onAccentSelect = (item: SelectButtonItem) => {
        setAccent(item);

        onChange({ ...value, color: `[${getCorpColor(item.value, saturation.value)}]` }, index);
    };

    const onSaturationSelect = (item: SelectButtonItem) => {
        setSaturation(item);

        onChange({ ...value, color: `[${getCorpColor(accent.value, item.value)}]` }, index);
    };

    const onSliderValueChange = (opacity: number) => {
        onChange({ ...value, opacity: opacity / 100 }, index);
    };

    const onColorValueChange = (newColor: string) => {
        let color = newColor
            .toUpperCase()
            .replace(/[^#A-F0-9]/g, '')
            .replace(/(?!^#)#/g, '')
            .slice(0, 7);

        if (!color.startsWith('#')) {
            color = `#${color}`;
        }

        onChange({ ...value, color }, index);
    };

    return (
        <StyledLayer>
            <StyledLayerHeader>
                <StyledLayerName>Тень {index + 1}</StyledLayerName>
                <StyledIconButton onClick={() => onDelete(index)}>
                    <IconTrashOutline size="xs" color="inherit" />
                </StyledIconButton>
            </StyledLayerHeader>
            <StyledShadowParams>
                <StyledRowParams>
                    <TextField
                        value={value.offsetX}
                        hasBackground
                        stretched
                        tooltipText="Смещение по X"
                        contentLeft={<StyledIconCharX size="xs" color="inherit" />}
                        onChange={onValueChange('offsetX')}
                    />
                    <TextField
                        value={value.offsetY}
                        hasBackground
                        stretched
                        tooltipText="Смещение по Y"
                        contentLeft={<StyledIconCharY size="xs" color="inherit" />}
                        onChange={onValueChange('offsetY')}
                    />
                </StyledRowParams>
                <StyledRowParams>
                    <TextField
                        value={value.blur}
                        hasBackground
                        stretched
                        tooltipText="Блюр"
                        contentLeft={<StyledIconCardsGridFill size="xs" color="inherit" />}
                        onChange={onValueChange('blur')}
                    />
                    <TextField
                        value={value.spread}
                        hasBackground
                        stretched
                        tooltipText="Распространение"
                        contentLeft={<StyledIconBrightness1Outline size="xs" color="inherit" />}
                        onChange={onValueChange('spread')}
                    />
                </StyledRowParams>
            </StyledShadowParams>
            <StyledRowParams>
                <SelectButton items={paletteList} selected={palette} onItemSelect={onPaletteSelect} />
                {palette.value === 'custom' ? (
                    <SelectButton items={colorFormatList} selected={colorFormatList[0]} onItemSelect={() => {}} />
                ) : (
                    <SelectButton items={accentColors} selected={accent} onItemSelect={onAccentSelect} />
                )}
                {palette.value === 'custom' ? (
                    <TextField value={value.color} onChange={onColorValueChange} />
                ) : (
                    <SelectButton items={saturationColors} selected={saturation} onItemSelect={onSaturationSelect} />
                )}
            </StyledRowParams>
            <Slider value={Number(((value.opacity ?? 1) * 100).toFixed(0))} onChange={onSliderValueChange} />
        </StyledLayer>
    );
};

export interface ShadowType {
    offsetX: string;
    offsetY: string;
    blur: string;
    spread: string;
    color: string;
    opacity?: number;
}

interface ShadowPickerProps {
    values: ShadowType[];
    onChange: (data: ShadowType[]) => void;
}

export const ShadowPicker = (props: ShadowPickerProps) => {
    const { values = [], onChange } = props;

    const onValueChange = (value: ShadowType, index: number) => {
        const newValues = [...values];
        newValues[index] = value;

        onChange(newValues);
    };

    const onLayerDelete = (index: number) => {
        const newValues = [...values];
        newValues.splice(index, 1);

        onChange(newValues);
    };

    const onLayerAdd = () => {
        onChange([
            ...values,
            { offsetX: '0', offsetY: '0', blur: '0', spread: '0', color: DEFAULT_CUSTOM_COLOR, opacity: 1 },
        ]);
    };

    return (
        <Root>
            {values.map((value, index) => (
                <Component key={index} value={value} index={index} onChange={onValueChange} onDelete={onLayerDelete} />
            ))}
            {values.length < 3 && (
                <LinkButton
                    text="Добавить тень"
                    contentLeft={<IconPlus size="xs" color="inherit" />}
                    onClick={onLayerAdd}
                />
            )}
        </Root>
    );
};
