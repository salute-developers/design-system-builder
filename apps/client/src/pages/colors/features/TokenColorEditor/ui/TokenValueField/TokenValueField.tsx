import { FocusEvent, MouseEvent } from 'react';
import { IconLink } from '@salutejs/plasma-icons';

import { IconButton, TextField } from '../../../../../../components';
import { ColorToken, GradientToken } from '../../../../../../controllers';
import { getDisplayColor } from '../../TokenColorEditor.utils';

import { StyledColorItemPreview, StyledTextFieldGroup, StyledTextFieldGroupLabel } from './TokenValueField.styles';

interface TokenValueFieldProps {
    mode: string;
    value: string;
    item: ColorToken | GradientToken;
    isActive: boolean;
    currentOpacity: number;
    colorValueStatus: 'default' | 'negative';
    onPreviewClick: (event: MouseEvent, item: ColorToken | GradientToken) => void;
    onPaletteUnlink: (item: ColorToken | GradientToken) => () => void;
    onInputValueBlur: (item: ColorToken | GradientToken) => (event: FocusEvent<HTMLInputElement>) => void;
    onInputValueChange: () => void;
    onOpacityCommit: (item: ColorToken | GradientToken) => (opacity: number) => void;
}

export const TokenValueField = (props: TokenValueFieldProps) => {
    const {
        mode,
        value,
        item,
        isActive,
        currentOpacity,
        colorValueStatus,
        onPreviewClick,
        onPaletteUnlink,
        onInputValueBlur,
        onInputValueChange,
        onOpacityCommit,
    } = props;

    const rawValue = item instanceof ColorToken ? (item.getValue('web') as string) : value;
    const [displayValue, leafOpacity] = getDisplayColor(rawValue);
    const opacityToShow = isActive ? currentOpacity : leafOpacity;

    const groupLabel = mode.charAt(0).toUpperCase() + mode.slice(1);
    const isReadOnly = rawValue.startsWith('[') || displayValue.startsWith('gradient');

    const contentRight = rawValue.startsWith('[') ? (
        <IconButton onClick={onPaletteUnlink(item)}>
            <IconLink size="xs" color="inherit" />
        </IconButton>
    ) : undefined;

    return (
        <StyledTextFieldGroup>
            <StyledTextFieldGroupLabel>{groupLabel}</StyledTextFieldGroupLabel>
            <TextField
                hasBackground
                stretched
                readOnly={isReadOnly}
                value={displayValue}
                contentLeft={
                    <StyledColorItemPreview onClick={(event) => onPreviewClick(event, item)} background={value} />
                }
                contentRight={contentRight}
                view={colorValueStatus}
                onBlur={(event) => onInputValueBlur(item)(event)}
                onKeyDown={onInputValueChange}
            />
            <TextField
                style={{ flex: 0.25 }}
                hasBackground
                stretched
                textAfter="%"
                compact
                value={opacityToShow ? `${Math.round(opacityToShow * 100)}` : '0'}
                onCommit={(value) => onOpacityCommit(item)(value ? parseInt(value) / 100 : 0)}
            />
        </StyledTextFieldGroup>
    );
};
