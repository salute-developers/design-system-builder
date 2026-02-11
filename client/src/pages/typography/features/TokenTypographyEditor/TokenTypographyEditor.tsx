import { useState, useEffect } from 'react';
import { IconClose } from '@salutejs/plasma-icons';

import { DesignSystem, Theme, TypographyToken } from '../../../../controllers';
import { TextField, SegmentButton, SegmentButtonItem } from '../../../../components';
import { TypographyPicker, TypographyType } from '../../../../features';
import { typographyTokenActions } from '../../../../actions';
import { updateTokenChange } from '../../../../utils';
import { TokenTypographyPreview } from '../TokenTypographyPreview';

import { Root, StyledHeader, StyledSetup, StyledLinkButton } from './TokenTypographyEditor.styles';
import { getTokenValue, screenSizeList } from './TokenTypographyEditor.utils';

interface TokenTypographyEditorProps {
    designSystem: DesignSystem;
    theme: Theme;
    tokens?: TypographyToken[];
    rerender: () => void;
}

export const TokenTypographyEditor = (props: TokenTypographyEditorProps) => {
    const { designSystem, theme, tokens, rerender } = props;

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

    const dsName = designSystem.getName() || '';
    const dsVersion = designSystem.getVersion() || '';

    const onScreenSizeSelect = (item: SegmentButtonItem) => {
        setScreenSize(item);
    };

    const onValueChange = (value: TypographyType) => {
        setValue(value);

        typographyTokenActions.updateToken({ value, token, designSystem });
        rerender();
    };

    const onDescriptionChange = (newDescription: string) => {
        if (!token) {
            return;
        }

        setDescription(newDescription);
        // TODO: Перенести в экшены?
        token.setDescription(newDescription);
        updateTokenChange(dsName, dsVersion, token);

        rerender();
    };

    const onTokenReset = () => {
        if (!token) {
            return;
        }

        typographyTokenActions.resetToken({ token, designSystem });

        const tokenValue = getTokenValue(token.getDefaultValue('web'), theme);

        setValue(tokenValue);
        setDescription(token.getDefaultDescription());

        rerender();
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
                <SegmentButton
                    label="Экран"
                    items={screenSizeList}
                    selected={screenSize}
                    onSelect={onScreenSizeSelect}
                />
                <TypographyPicker value={value} onChange={onValueChange} />
                <StyledLinkButton
                    text="Отменить изменения"
                    contentLeft={<IconClose size="xs" />}
                    onClick={onTokenReset}
                />
            </StyledSetup>
            <TokenTypographyPreview value={value} theme={theme} />
        </Root>
    );
};
