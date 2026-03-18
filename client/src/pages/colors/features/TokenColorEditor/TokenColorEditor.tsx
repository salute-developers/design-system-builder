import { useState, useEffect } from 'react';
import { IconClose } from '@salutejs/plasma-icons';

import { DesignSystem, ColorToken, GradientToken, Theme } from '../../../../controllers';
import { getColorAndOpacity, updateTokenChange } from '../../../../utils';
import { ColorPicker, GradientPicker } from '../../../../features';
import { TextField, SegmentButton, SegmentButtonItem, SelectButton, SelectButtonItem } from '../../../../components';
import { colorTokenActions, gradientTokenActions } from '../../../../actions';
import { TokenColorPreview } from '../TokenColorPreview';

import { Root, StyledHeader, StyledSetup, StyledLinkButton } from './TokenColorEditor.styles';
import { modeList, typeList } from './TokenColorEditor.utils';

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

    const onColorChange = (newValue: string | string[]) => {
        setColor(Array.isArray(newValue) ? newValue.join(', ') : newValue);

        if (token instanceof ColorToken) {
            colorTokenActions.updateToken({
                color: newValue as string,
                opacity,
                token,
                theme,
                designSystem,
            });
        }

        if (token instanceof GradientToken) {
            gradientTokenActions.updateToken({
                gradient: newValue as string[],
                token,
                theme,
                designSystem,
            });
        }

        rerender();
    };

    const onOpacityChange = (newOpacity: number) => {
        setOpacity(newOpacity);

        if (token instanceof ColorToken) {
            colorTokenActions.updateToken({
                color,
                opacity: newOpacity,
                token,
                theme,
                designSystem,
            });
        }

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
        if (token instanceof ColorToken) {
            const { color, opacity, description } = colorTokenActions.resetToken({
                token,
                theme,
                designSystem,
            });

            setColor(color);
            setOpacity(opacity);
            setDescription(description);
        }

        rerender();
    };

    useEffect(() => {
        if (!token) {
            return;
        }

        const [colorValue, opacityValue] = getColorAndOpacity(token.getValue('web'));
        setType(token instanceof GradientToken ? typeList[1] : typeList[0]);
        setColor(token instanceof GradientToken ? token.getValue('web').join(', ') : colorValue);
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
                {type.value === 'gradient' && <GradientPicker color={color} onColorChange={onColorChange} />}
                {type.value === 'color' && (
                    <ColorPicker
                        opacity={opacity}
                        color={color}
                        onColorChange={onColorChange}
                        onOpacityChange={onOpacityChange}
                    />
                )}
                <StyledLinkButton
                    text="Отменить изменения"
                    contentLeft={<IconClose size="xs" />}
                    onClick={onTokenReset}
                />
            </StyledSetup>
            <TokenColorPreview color={color} opacity={opacity} theme={theme} type={type.value} />
        </Root>
    );
};
