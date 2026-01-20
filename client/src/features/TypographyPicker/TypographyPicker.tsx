import { useEffect, useState } from 'react';

import { WebFontStyle, WebFontWeight } from '../../controllers';
import { numberFormatter } from '../../utils';
import { TextField, SelectButton, SelectButtonItem } from '../../components';
import {
    Root,
    StyledTypographyParams,
    StyledIconSizeMaximize,
    StyledIconLineHeight,
    StyledIconLetterSpacing,
} from './TypographyPicker.styles';
import { fontStyleList, fontWeightList, getLabelByItem } from './TypographyPicker.utils';

export interface TypographyType {
    fontFamily: string;
    fontWeight: WebFontWeight;
    fontStyle: WebFontStyle;
    fontSize: string;
    lineHeight: string;
    letterSpacing: string;
}

interface TypographyPickerProps {
    value: TypographyType;
    onChange: (data: TypographyType) => void;
}

export const TypographyPicker = (props: TypographyPickerProps) => {
    const { value, onChange } = props;

    const [fontStyle, setFontStyle] = useState<SelectButtonItem>({
        label: getLabelByItem(fontStyleList, value.fontStyle),
        value: value.fontStyle,
    });

    const [fontWeight, setFontWeight] = useState<SelectButtonItem>({
        label: getLabelByItem(fontWeightList, value.fontWeight),
        value: value.fontWeight,
    });

    const onFontStyleSelect = (item: SelectButtonItem) => {
        setFontStyle(item);

        onChange({ ...value, fontStyle: item.value as WebFontStyle });
    };

    const onFontWightSelect = (item: SelectButtonItem) => {
        setFontWeight(item);

        onChange({ ...value, fontWeight: item.value as WebFontWeight });
    };

    const onValueChange = (name: keyof TypographyType) => (newValue: string) => {
        const prevValue = value[name];
        const formattedValue = numberFormatter(newValue, prevValue);

        if (!formattedValue) {
            return;
        }

        onChange({
            ...value,
            [name]: formattedValue,
        });
    };

    useEffect(() => {
        setFontStyle({
            label: getLabelByItem(fontStyleList, value.fontStyle),
            value: value.fontStyle,
        });
        setFontWeight({
            label: getLabelByItem(fontWeightList, value.fontWeight),
            value: value.fontWeight,
        });
    }, [value]);

    return (
        <Root>
            <TextField label="Шрифт" value={value.fontFamily} readOnly />
            <StyledTypographyParams>
                <TextField
                    value={value.fontSize}
                    hasBackground
                    stretched
                    tooltipText="Размер текста"
                    contentLeft={<StyledIconSizeMaximize size="xs" color="inherit" />}
                    onChange={onValueChange('fontSize')}
                />
                <TextField
                    value={value.lineHeight}
                    hasBackground
                    stretched
                    tooltipText="Высота строки"
                    contentLeft={<StyledIconLineHeight size="xs" color="inherit" />}
                    onChange={onValueChange('lineHeight')}
                />
                <TextField
                    value={value.letterSpacing}
                    hasBackground
                    stretched
                    tooltipText="Межбуквенный интервал"
                    textAfter="%"
                    contentLeft={<StyledIconLetterSpacing size="xs" color="inherit" />}
                    onChange={onValueChange('letterSpacing')}
                />
            </StyledTypographyParams>
            <SelectButton label="Стиль" items={fontStyleList} selected={fontStyle} onItemSelect={onFontStyleSelect} />
            <SelectButton
                label="Начертание"
                items={fontWeightList}
                selected={fontWeight}
                onItemSelect={onFontWightSelect}
            />
        </Root>
    );
};
