import { useEffect, useRef, useState } from 'react';
import { general } from '@salutejs/plasma-colors/dist/general';
import { IconSearch } from '@salutejs/plasma-icons';

import { SelectButtonItem, TextField, Tooltip } from '../../../../components';
import { getCorpColor, prettifyColorName, separatedCorpColor } from '../../../../utils';

import {
    Root,
    StyledColorSelector,
    StyledTools,
    StyledColorsWrapper,
    SelectColorLabel,
    StyledColorItem,
    StyledColorPreview,
} from './PaletteColorSelector.styles';
import { accentColors, saturationColors } from './PaletteColorSelector.utils';

interface PaletteColorSelectorProps {
    color: string;
    opacity?: number;
    onChange?: (color: string) => void;
    onClose?: () => void;
}

export const PaletteColorSelector = (props: PaletteColorSelectorProps) => {
    const { color, onChange, onClose } = props;

    const [innerColor, setInnerColor] = useState(color);
    const [, accentValue, saturationValue] = separatedCorpColor(innerColor);

    const [searchValue, setSearchValue] = useState('');

    const [accent, setAccent] = useState<SelectButtonItem>({
        label: prettifyColorName(accentValue),
        value: accentValue,
    });

    const [saturation, setSaturation] = useState<SelectButtonItem>({
        label: saturationValue,
        value: saturationValue,
    });

    const activeColorRef = useRef<HTMLDivElement | null>(null);

    const onColorSelect = (accentColor: SelectButtonItem, saturationColor: SelectButtonItem) => {
        const selectedColor = getCorpColor(accentColor.value, saturationColor.value);

        setInnerColor(selectedColor);

        if (onChange) {
            onChange(selectedColor);
        }

        if (onClose) {
            onClose();
        }
    };

    const onSearchValueChange = (value: string) => {
        setSearchValue(value);
    };

    useEffect(() => {
        setInnerColor(color);

        const [, accentValue, saturationValue] = separatedCorpColor(color);
        setAccent({ label: prettifyColorName(accentValue), value: accentValue });
        setSaturation({ label: saturationValue, value: saturationValue });
    }, [color]);

    useEffect(() => {
        activeColorRef.current?.scrollIntoView({ block: 'center' });
    }, [accent.value, saturation.value]);

    const searchedItems = (saturationItem: SelectButtonItem, accentColor: SelectButtonItem) =>
        !searchValue || `${accentColor.value}-${saturationItem.value}`.includes(searchValue);

    return (
        <Root>
            <StyledTools>
                <TextField
                    stretched
                    placeholder="Найти"
                    value={searchValue}
                    contentLeft={<IconSearch size="xs" color="inherit" />}
                    onChange={onSearchValueChange}
                />
            </StyledTools>
            <StyledColorSelector>
                {accentColors.map((accentColor) => (
                    <StyledColorItem key={accentColor.value}>
                        <SelectColorLabel>{accentColor.label}</SelectColorLabel>
                        <StyledColorsWrapper>
                            {saturationColors
                                .filter((saturationItem) => searchedItems(saturationItem, accentColor))
                                .map((saturationItem) => {
                                    const isActive =
                                        accentColor.value === accent.value && saturationItem.value === saturation.value;

                                    return (
                                        <StyledColorPreview
                                            key={`${accentColor.value}-${saturationItem.value}`}
                                            ref={isActive ? activeColorRef : undefined}
                                            selected={isActive}
                                            style={{ background: general[accentColor.value][saturationItem.value] }}
                                            onClick={() => onColorSelect(accentColor, saturationItem)}
                                        >
                                            <Tooltip
                                                offset={[0.25, 0]}
                                                placement="bottom"
                                                text={`${accentColor.value}-${saturationItem.value}`}
                                            />
                                        </StyledColorPreview>
                                    );
                                })}
                        </StyledColorsWrapper>
                    </StyledColorItem>
                ))}
            </StyledColorSelector>
        </Root>
    );
};
