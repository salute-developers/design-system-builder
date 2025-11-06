import { useState, useEffect, useMemo, MouseEvent } from 'react';
import styled from 'styled-components';
import { IconClose, IconCopyOutline, IconDone } from '@salutejs/plasma-icons';
import { backgroundTertiary } from '@salutejs/plasma-themes/tokens/plasma_infra';
import { getRestoredColorFromPalette } from '@salutejs/plasma-tokens-utils';

import { ColorToken, GradientToken, Theme } from '../../../themeBuilder';
import { ColorFormats, convertColor, getColorAndOpacity } from '../../utils';
import { DesignSystem } from '../../../designSystem';
import { SegmentButton, SegmentButtonItem } from '../../components/SegmentButton';
import { ColorPicker } from '../../components/ColorPicker';
import { SelectButton, SelectButtonItem } from '../../components/SelectButton';
import { TextField } from '../../components/TextField';
import { EditButton } from '../../components/EditButton';
import { LinkButton } from '../../components/LinkButton';

const Root = styled.div`
    width: 20rem;
    height: 100%;
    background: ${backgroundTertiary};

    box-sizing: border-box;
    padding: 0.75rem 1.25rem;

    display: flex;
    flex-direction: column;
    gap: 1.5rem;
`;

const StyledHeader = styled.div`
    display: flex;
    flex-direction: column;

    margin-left: -0.375rem;
`;

const StyledSetup = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
`;

const StyledColorFormats = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
`;

const StyledIconCopyOutline = styled(IconCopyOutline)`
    --icon-size: 0.75rem !important;
`;

const StyledIconDone = styled(IconDone)`
    --icon-size: 0.75rem !important;
`;

const StyledLinkButton = styled(LinkButton)`
    position: absolute;
    bottom: 3rem;
`;

const modeList = [
    {
        label: 'Тёмный',
        value: 0,
    },
    {
        label: 'Светлый',
        value: 1,
    },
];

const typeList = [
    {
        label: 'Сплошной',
        value: 'solid',
    },
    {
        label: 'Градиент',
        value: 'gradient',
        disabled: true,
    },
];

interface ColorValueEditButton {
    label: string;
    format: keyof ColorFormats;
    color: string;
    opacity: number;
}

const ColorValueEditButton = (props: ColorValueEditButton) => {
    const { label, color, opacity, format } = props;

    const [copied, setCopied] = useState<boolean | undefined>();

    const value = useMemo(() => {
        const colorValue = getRestoredColorFromPalette(`[${color}][${opacity}]`, -1) ?? color;

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
    onTokenUpdate: () => void;
}

export const TokenColorEditor = (props: TokenColorEditorProps) => {
    const { designSystem, theme, tokens, onTokenUpdate } = props;

    const [mode, setMode] = useState<SegmentButtonItem>({
        label: 'Тёмный',
        value: 0,
    });
    const [type, setType] = useState<SelectButtonItem>({
        label: 'Сплошной',
        value: 'solid',
    });
    const [color, setColor] = useState<string>('#FFFFFF');
    const [opacity, setOpacity] = useState<number>(1);

    const token = tokens?.[Number(mode.value)];

    const [description, setDescription] = useState<string | undefined>(token?.getDescription());

    // TODO: Пока только для значений из палитры
    const updateTokenValue = (color: string, opacity: number) => {
        if (!token) {
            return;
        }

        if (token instanceof ColorToken) {
            const newColor = `[${color}]${opacity === 1 ? '' : `[${opacity}]`}`;

            token.setValue('web', newColor);
            token.setValue('ios', newColor);
            token.setValue('android', newColor);

            onTokenUpdate();
        }
    };

    const onModeSelect = (item: SegmentButtonItem) => {
        setMode(item);
    };

    const onTypeSelect = (item: SelectButtonItem) => {
        setType(item);
    };

    const onColorChange = (newColor: string) => {
        setColor(newColor);

        updateTokenValue(newColor, opacity);
    };

    const onOpacityChange = (newOpacity: number) => {
        setOpacity(newOpacity);

        updateTokenValue(color, newOpacity);
    };

    const onDescriptionChange = (newDescription: string) => {
        if (!token) {
            return;
        }

        setDescription(newDescription);
        token.setDescription(newDescription);
    };

    const onTokenReset = () => {
        if (!token) {
            return;
        }

        const [colorValue, opacityValue] = getColorAndOpacity(token.getDefaultValue('web'));
        setColor(colorValue);
        setOpacity(opacityValue);
        setDescription(token.getDefaultDescription());
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
            <StyledHeader>
                <TextField readOnly value={token?.getDisplayName()} />
                <TextField value={description} onCommit={onDescriptionChange} />
            </StyledHeader>
            <StyledSetup>
                <SegmentButton label="Режим" items={modeList} selected={mode} onSelect={onModeSelect} />
                <SelectButton label="Тип" items={typeList} selected={type} onItemSelect={onTypeSelect} />
            </StyledSetup>
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
            <StyledLinkButton text="Отменить изменения" contentLeft={<IconClose size="xs" />} onClick={onTokenReset} />
        </Root>
    );
};
