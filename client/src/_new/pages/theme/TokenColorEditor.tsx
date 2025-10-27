import { useState, useEffect, useMemo, MouseEvent } from 'react';
import styled from 'styled-components';
import { IconClose, IconCopyOutline, IconDone } from '@salutejs/plasma-icons';
import { backgroundTertiary } from '@salutejs/plasma-themes/tokens/plasma_infra';
import { getRestoredColorFromPalette } from '@salutejs/plasma-tokens-utils';

import {
    AndroidColor,
    AndroidGradient,
    ColorToken,
    GradientToken,
    IOSColor,
    IOSGradient,
    ShapeToken,
    SpacingToken,
    Theme,
    WebColor,
    WebGradient,
} from '../../../themeBuilder';
import { camelToKebab, ColorFormats, convertColor, getColorAndOpacity, h6, kebabToCamel } from '../../utils';
import { Token } from '../../../themeBuilder/tokens/token';
import { DesignSystem } from '../../../designSystem';
import { SegmentButton, SegmentButtonItem } from '../../components/SegmentButton';
import { ColorPicker } from '../../components/ColorPicker';
import { SelectButton, SelectButtonItem } from '../../components/SelectButton';
import { TextField } from '../../components/TextField';
import { TextArea } from '../../components/TextArea';
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

const createNewTokens = (theme: Theme, context?: (string | undefined)[]) => {
    const [type, mode, ...rest] = (context as string[]) || [];
    const replaceTo = mode === 'dark' ? 'light' : 'dark';

    const createMeta = (mode: string) => ({
        tags: [mode, ...rest, 'initial-name'],
        name: [mode, ...rest, 'initial-name'].join('.'),
        displayName: 'displayName',
        description: 'description',
        enabled: true,
    });

    const createTokens = (type: string) => {
        if (type === 'color') {
            const newToken = new ColorToken(createMeta(mode), {
                web: new WebColor(''),
                ios: new IOSColor(''),
                android: new AndroidColor(''),
            });
            const secondNewToken = new ColorToken(createMeta(replaceTo), {
                web: new WebColor(''),
                ios: new IOSColor(''),
                android: new AndroidColor(''),
            });

            theme.addToken(type, secondNewToken);
            return theme.addToken(type, newToken);
        }

        if (type === 'gradient') {
            const newToken = new GradientToken(createMeta(mode), {
                web: new WebGradient(['']),
                ios: new IOSGradient([]),
                android: new AndroidGradient([]),
            });
            const secondNewToken = new GradientToken(createMeta(replaceTo), {
                web: new WebGradient(['']),
                ios: new IOSGradient([]),
                android: new AndroidGradient([]),
            });

            theme.addToken(type, secondNewToken);
            return theme.addToken(type, newToken);
        }
    };

    return createTokens(type);
};

const updateTokens = (theme: Theme, updatedToken: Token, data: any) => {
    const [, ...rest] = updatedToken.getTags();
    const lightTokenName = theme.getToken(['light', ...rest].join('.'), updatedToken.getType());
    const darkTokenName = theme.getToken(['dark', ...rest].join('.'), updatedToken.getType());

    [lightTokenName, darkTokenName].forEach((token) => {
        if (!token) {
            return;
        }

        const [mode, category, subcategory] = token.getTags();
        const tokenDisplayName = kebabToCamel(
            (subcategory === 'default' ? category : [subcategory, category].join('-')) + '-' + data.editableName,
        );
        const tokenTags = [mode, category, subcategory, camelToKebab(data.editableName)];
        const tokenName = tokenTags.join('.');

        token?.setName(tokenName);
        token?.setTags(tokenTags);
        token?.setDisplayName(tokenDisplayName);

        token?.setEnabled(data.enabled);
        token?.setDescription(data.description);
    });

    // TODO: Добавить генерацию для нативных платформ

    if (updatedToken instanceof GradientToken) {
        updatedToken?.setValue('web', data.value.split('\n'));
    }

    if (updatedToken instanceof ColorToken) {
        updatedToken?.setValue('web', data.value);
    }

    if (updatedToken instanceof ShapeToken) {
        updatedToken?.setValue('web', data.value);
    }

    if (updatedToken instanceof SpacingToken) {
        updatedToken?.setValue('web', data.value);
    }

    // if (updatedToken instanceof ShadowToken) {
    //     console.log('data.value', typeof data.value);

    //     updatedToken?.setValue('web', data.value);
    // }
};

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
    tokens?: Token[];
}

export const TokenColorEditor = (props: TokenColorEditorProps) => {
    const { designSystem, theme, tokens } = props;

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
    const value = token?.getValue('web');

    const onModeSelect = (item: SegmentButtonItem) => {
        setMode(item);
    };

    const onTypeSelect = (item: SelectButtonItem) => {
        setType(item);
    };

    const onColorChange = (color: string) => {
        setColor(color);
    };

    const onOpacityChange = (opacity: number) => {
        setOpacity(opacity);
    };

    useEffect(() => {
        const [colorValue, opacityValue] = getColorAndOpacity(value);

        setColor(colorValue);
        setOpacity(opacityValue);
    }, [value]);

    return (
        <Root>
            <StyledHeader>
                <TextField readOnly value={token?.getDisplayName()} />
                <TextArea value={token?.getDescription()} />
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
            <StyledLinkButton text="Отменить изменения" contentLeft={<IconClose size="xs" />} />
        </Root>
    );
};
