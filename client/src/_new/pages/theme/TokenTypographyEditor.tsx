import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { IconClose } from '@salutejs/plasma-icons';
import { backgroundTertiary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { Theme, TypographyToken } from '../../../themeBuilder';
import { Token } from '../../../themeBuilder/tokens/token';
import { DesignSystem } from '../../../designSystem';
import { SegmentButton, SegmentButtonItem } from '../../components/SegmentButton';
import { TextField } from '../../components/TextField';
import { TextArea } from '../../components/TextArea';
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

const getTokenValue = (token: TypographyToken, theme: Theme) => {
    const { fontFamilyRef, fontStyle, fontWeight, ...values } = token.getValue('web');

    const fontFamily =
        theme.getTokenValue(fontFamilyRef.replace('fontFamily.', ''), 'fontFamily', 'web')?.name || 'Font Family';
    const fontSize = (parseInt(values.fontSize) * 16).toString();
    const lineHeight = (parseInt(values.lineHeight) * 16).toString();
    const letterSpacing = values.letterSpacing === 'normal' ? '0' : values.letterSpacing.replace(/r?em/gm, '');
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
    tokens?: Token[];
}

export const TokenTypographyEditor = (props: TokenTypographyEditorProps) => {
    const { designSystem, theme, tokens } = props;

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

    const onScreenSizeSelect = (item: SegmentButtonItem) => {
        setScreenSize(item);
    };

    const onValueChange = (value: TypographyType) => {
        setValue(value);
    };

    useEffect(() => {
        if (!token || !theme) {
            return;
        }

        const tokenValue = getTokenValue(token, theme);

        setValue(tokenValue);
    }, [token, theme]);

    return (
        <Root>
            <StyledHeader>
                <TextField readOnly value={token?.getDisplayName()} />
                <TextArea value={token?.getDescription()} />
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
            <StyledLinkButton text="Отменить изменения" contentLeft={<IconClose size="xs" />} />
        </Root>
    );
};
