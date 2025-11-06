import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { IconClose } from '@salutejs/plasma-icons';
import { backgroundTertiary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import {
    AndroidFontWeight,
    IOSFontStyle,
    IOSFontWeight,
    Theme,
    TypographyToken,
    WebTypographyToken,
} from '../../../themeBuilder';
import { DesignSystem } from '../../../designSystem';
import { SegmentButton, SegmentButtonItem } from '../../components/SegmentButton';
import { TextField } from '../../components/TextField';
import { TypographyPicker, TypographyType } from '../../components/TypographyPicker';
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

const StyledLinkButton = styled(LinkButton)`
    position: absolute;
    bottom: 3rem;
`;

const getTokenValue = (token: WebTypographyToken[string], theme: Theme) => {
    const { fontFamilyRef, fontStyle, fontWeight, ...values } = token;

    const fontFamily =
        theme.getTokenValue(fontFamilyRef.replace('fontFamily.', ''), 'fontFamily', 'web')?.name || 'Font Family';
    const fontSize = (parseFloat(values.fontSize) * 16).toString();
    const lineHeight = (parseFloat(values.lineHeight) * 16).toString();
    const letterSpacing = values.letterSpacing === 'normal' ? '0' : Number(parseFloat(values.letterSpacing)).toString();

    return {
        fontFamily,
        fontWeight,
        fontStyle,
        fontSize,
        lineHeight,
        letterSpacing,
    };
};

const screenSizeList = [
    {
        label: 'Большой',
        value: 0,
    },
    {
        label: 'Средний',
        value: 1,
    },
    {
        label: 'Маленький',
        value: 2,
    },
];

interface TokenTypographyEditorProps {
    designSystem: DesignSystem;
    theme: Theme;
    tokens?: TypographyToken[];
    onTokenUpdate: () => void;
}

export const TokenTypographyEditor = (props: TokenTypographyEditorProps) => {
    const { designSystem, theme, tokens, onTokenUpdate } = props;

    const [screenSize, setScreenSize] = useState<SegmentButtonItem>({
        label: 'Большой',
        value: 0,
    });
    const [value, setValue] = useState<TypographyType>({
        fontFamily: 'Font Family',
        fontWeight: '400',
        fontStyle: 'normal',
        fontSize: '16',
        lineHeight: '22',
        letterSpacing: 'normal',
    });

    const token = tokens?.[Number(screenSize.value)];
    const [description, setDescription] = useState<string | undefined>(token?.getDescription());

    const updateTokenValue = (value: TypographyType) => {
        if (!token) {
            return;
        }

        const { fontSize, lineHeight, fontStyle, fontWeight, letterSpacing } = value;

        const webValue = {
            fontFamilyRef: token.getValue('web').fontFamilyRef,
            fontWeight,
            fontStyle,
            fontSize: `${Number(fontSize) / 16}rem`,
            lineHeight: `${Number(lineHeight) / 16}rem`,
            letterSpacing: Number(letterSpacing) === 0 ? 'normal' : `${Number(letterSpacing) / 16}em`,
        };

        const iosFontWeightMap = {
            '900': 'black',
            '800': 'bold',
            '700': 'heavy',
            '600': 'semibold',
            '500': 'medium',
            '400': 'regular',
            '300': 'light',
            '200': 'ultraLight',
            '100': 'thin',
        };

        const iosValue = {
            fontFamilyRef: token.getValue('ios').fontFamilyRef,
            weight: iosFontWeightMap[fontWeight] as IOSFontWeight,
            style: fontStyle as IOSFontStyle,
            size: Number(fontSize),
            lineHeight: Number(lineHeight),
            kerning: Number(letterSpacing),
        };

        const androidValue = {
            fontFamilyRef: token.getValue('android').fontFamilyRef,
            fontWeight: Number(fontWeight) as AndroidFontWeight,
            fontStyle,
            textSize: Number(fontSize),
            lineHeight: Number(lineHeight),
            letterSpacing: Number(letterSpacing),
        };

        token.setValue('web', webValue);
        token.setValue('ios', iosValue);
        token.setValue('android', androidValue);

        onTokenUpdate();
    };

    const onScreenSizeSelect = (item: SegmentButtonItem) => {
        setScreenSize(item);
    };

    const onValueChange = (value: TypographyType) => {
        setValue(value);

        updateTokenValue(value);
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

        const tokenValue = getTokenValue(token.getDefaultValue('web'), theme);
        setValue(tokenValue);
        setDescription(token.getDescription());
        setDescription(token.getDefaultDescription());
    };

    useEffect(() => {
        if (!token || !theme) {
            return;
        }

        const tokenValue = getTokenValue(token.getValue('web'), theme);
        setValue(tokenValue);
        setDescription(token.getDescription());
    }, [token, theme]);

    return (
        <Root>
            <StyledHeader>
                <TextField readOnly value={token?.getDisplayName()} />
                <TextField value={description} onCommit={onDescriptionChange} />
            </StyledHeader>
            <StyledSetup>
                <SegmentButton
                    label="Экран"
                    items={screenSizeList}
                    selected={screenSize}
                    onSelect={onScreenSizeSelect}
                />
            </StyledSetup>
            <TypographyPicker value={value} onChange={onValueChange} />
            <StyledLinkButton text="Отменить изменения" contentLeft={<IconClose size="xs" />} onClick={onTokenReset} />
        </Root>
    );
};
