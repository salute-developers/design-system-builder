import { useEffect, useState } from 'react';
import { IconClose } from '@salutejs/plasma-icons';

import { SegmentButton, SegmentButtonItem } from '../../components';
import { VariationType } from '../../controllers';
import { StyledHeader, StyledIconButton, StyledModal } from './ColorPicker.styles';
import { CustomColorSelector, PaletteColorSelector } from './ui';
import { getTypeList } from './ColorPicker.utils';

interface ColorPickerProps {
    color: string;
    opacity: number;
    opened: boolean;
    anchor?: HTMLElement;
    tokenType: VariationType;
    initialType?: 'custom' | 'library';
    onColorChange: (color: string | string[]) => void;
    onOpacityChange: (opacity: number) => void;
    onClose: () => void;
}

export const ColorPicker = (props: ColorPickerProps) => {
    const { tokenType, color, opacity, opened, anchor, initialType, onColorChange, onOpacityChange, onClose } = props;

    const typeList = getTypeList(tokenType);
    const defaultType = typeList.find((item) => item.value === (initialType ?? 'custom')) ?? typeList[0];
    const [type, setType] = useState<SegmentButtonItem>(defaultType);

    const onTypeSelect = (item: SegmentButtonItem) => {
        setType(item);
    };

    useEffect(() => {
        if (!opened) {
            return;
        }

        const nextType = typeList.find((item) => item.value === (initialType ?? 'custom')) ?? typeList[0];
        setType(nextType);
    }, [opened, initialType]);

    return (
        <StyledModal opened={opened} anchor={anchor} anchorOffsetX={4} anchorOffsetY={-4} onClose={onClose}>
            <StyledHeader>
                <SegmentButton items={typeList} selected={type} onSelect={onTypeSelect} />
                <StyledIconButton onClick={onClose}>
                    <IconClose size="xs" color="inherit" />
                </StyledIconButton>
            </StyledHeader>

            {type.value === 'custom' && (
                <CustomColorSelector
                    tokenType={tokenType}
                    opacity={opacity}
                    color={color}
                    onColorChange={onColorChange}
                    onOpacityChange={onOpacityChange}
                />
            )}

            {type.value === 'library' && (
                <PaletteColorSelector color={color} opacity={opacity} onChange={onColorChange} onClose={onClose} />
            )}
        </StyledModal>
    );
};
