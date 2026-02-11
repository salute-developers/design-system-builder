import { useState, useEffect, useMemo, MouseEvent } from 'react';
import { IconClose } from '@salutejs/plasma-icons';

import { DesignSystem, ColorToken, GradientToken, Theme } from '../../../../controllers';
import { convertColor, getColorAndOpacity, getNormalizedColor, updateTokenChange } from '../../../../utils';
import { ColorFormats } from '../../../../types';
import { ColorPicker } from '../../../../features';
import {
    TextField,
    EditButton,
    SegmentButton,
    SegmentButtonItem,
    SelectButton,
    SelectButtonItem,
} from '../../../../components';
import { colorTokenActions } from '../../../../actions';
import { TokenColorPreview } from '../TokenColorPreview';

import {
    Root,
    StyledHeader,
    StyledSetup,
    StyledColorFormats,
    StyledLinkButton,
    StyledIconDone,
    StyledIconCopyOutline,
} from './TokenColorEditor.styles';
import { modeList, typeList } from './TokenColorEditor.utils';

interface ColorValueEditButtonProps {
    label: string;
    format: keyof ColorFormats;
    color: string;
    opacity: number;
}

const ColorValueEditButton = (props: ColorValueEditButtonProps) => {
    const { label, color, opacity, format } = props;

    const [copied, setCopied] = useState<boolean | undefined>();

    const value = useMemo(() => {
        const colorValue = getNormalizedColor(color, opacity);

        return convertColor(colorValue)[format];
    }, [color, opacity, format]);

    const colorFormatContentRight =
        copied === undefined ? undefined : copied ? <StyledIconDone /> : <StyledIconCopyOutline />;

    const onButtonInteract = (newValue: boolean | undefined, toCopy?: boolean) => (_: MouseEvent<HTMLDivElement>) => {
        setCopied(newValue);

        if (toCopy) {
            navigator.clipboard.writeText(value);
        }
    };

    return (
        <EditButton
            label={label}
            text={value}
            contentRight={colorFormatContentRight}
            onClick={onButtonInteract(true, true)}
            onMouseEnter={onButtonInteract(false)}
            onMouseLeave={onButtonInteract(undefined)}
        />
    );
};

interface TokenColorEditorProps {
    designSystem: DesignSystem;
    theme: Theme;
    tokens?: (ColorToken | GradientToken)[];
    rerender: () => void;
}

export const TokenColorEditor = (props: TokenColorEditorProps) => {
    const { designSystem, theme, tokens, rerender } = props;

    const [mode, setMode] = useState<SegmentButtonItem>(modeList[0]);
    const [type, setType] = useState<SelectButtonItem>(typeList[0]);
    const [color, setColor] = useState<string>('#FFFFFF');
    const [opacity, setOpacity] = useState<number>(1);

    const token = tokens?.[Number(mode.value)];

    const [description, setDescription] = useState<string | undefined>(token?.getDescription());

    const dsName = designSystem.getName() || '';
    const dsVersion = designSystem.getVersion() || '';

    const onModeSelect = (item: SegmentButtonItem) => {
        setMode(item);
    };

    const onTypeSelect = (item: SelectButtonItem) => {
        setType(item);
    };

    const onColorChange = (newColor: string) => {
        setColor(newColor);

        colorTokenActions.updateToken({
            color: newColor,
            opacity,
            token,
            theme,
            designSystem,
        });

        rerender();
    };

    const onOpacityChange = (newOpacity: number) => {
        setOpacity(newOpacity);

        colorTokenActions.updateToken({
            color,
            opacity: newOpacity,
            token,
            theme,
            designSystem,
        });

        rerender();
    };

    const onDescriptionChange = (newDescription: string) => {
        if (!token) {
            return;
        }

        setDescription(newDescription);
        
        // TODO: Перенести в экшены?
        token.setDescription(newDescription);
        updateTokenChange(dsName, dsVersion, token, 'save');

        rerender();
    };

    const onTokenReset = () => {
        const { color, opacity, description } = colorTokenActions.resetToken({
            token,
            theme,
            designSystem,
        });

        setColor(color);
        setOpacity(opacity);
        setDescription(description);

        rerender();
    };

    useEffect(() => {
        if (!token) {
            return;
        }

        const [colorValue, opacityValue] = getColorAndOpacity(token.getValue('web'));
        setColor(colorValue);
        setOpacity(opacityValue);
        setDescription(token.getDescription());
    }, [token]);

    return (
        <Root>
            <StyledSetup>
                <StyledHeader>
                    <TextField readOnly value={token?.getDisplayName()} />
                    <TextField
                        value={description}
                        maxWidth={286}
                        placeholder="Добавить описание"
                        onCommit={onDescriptionChange}
                    />
                </StyledHeader>
                <SegmentButton label="Режим" items={modeList} selected={mode} onSelect={onModeSelect} />
                <SelectButton label="Тип" items={typeList} selected={type} onItemSelect={onTypeSelect} />
                <ColorPicker
                    opacity={opacity}
                    color={color}
                    onColorChange={onColorChange}
                    onOpacityChange={onOpacityChange}
                />
                <StyledColorFormats>
                    <ColorValueEditButton label="Hex" color={color} opacity={opacity} format="hex" />
                    <ColorValueEditButton label="RGB" color={color} opacity={opacity} format="rgb" />
                    <ColorValueEditButton label="HSL" color={color} opacity={opacity} format="hsl" />
                </StyledColorFormats>
                <StyledLinkButton
                    text="Отменить изменения"
                    contentLeft={<IconClose size="xs" />}
                    onClick={onTokenReset}
                />
            </StyledSetup>
            <TokenColorPreview color={color} opacity={opacity} theme={theme} />
        </Root>
    );
};
