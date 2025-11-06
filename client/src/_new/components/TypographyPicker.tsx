import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { IconSizeMaximize } from '@salutejs/plasma-icons';

import { TextField } from './TextField';
import { IconLetterSpacing, IconLineHeight } from '../_icons';
import { SelectButton, SelectButtonItem } from './SelectButton';
import { WebFontStyle, WebFontWeight } from '../../themeBuilder';
import { numberFormatter } from '../utils';

const Root = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
`;

const StyledTypographyParams = styled.div`
    display: flex;
    gap: 0.25rem;
`;

const StyledIconSizeMaximize = styled(IconSizeMaximize)`
    --icon-size: 0.75rem !important;
`;

const StyledIconLineHeight = styled(IconLineHeight)`
    --icon-size: 0.75rem !important;
`;

const StyledIconLetterSpacing = styled(IconLetterSpacing)`
    --icon-size: 0.75rem !important;
`;

const fontStyleList = [
    {
        label: 'Normal',
        value: 'normal',
    },
    {
        label: 'Italic',
        value: 'italic',
    },
];

const fontWeightList = [
    {
        label: 'Thin',
        value: '100',
    },
    {
        label: 'Extra Light',
        value: '200',
    },
    {
        label: 'Light',
        value: '300',
    },
    {
        label: 'Regular',
        value: '400',
    },
    {
        label: 'Medium',
        value: '500',
    },
    {
        label: 'Semi Bold',
        value: '600',
    },
    {
        label: 'Bold',
        value: '700',
    },
    {
        label: 'Extra Bold',
        value: '800',
    },
    {
        label: 'Black',
        value: '900',
    },
];

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
        value: value.fontStyle,
    });

    const [fontWeight, setFontWeight] = useState<SelectButtonItem>({
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
        setFontStyle({ value: value.fontStyle });
        setFontWeight({ value: value.fontWeight });
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
