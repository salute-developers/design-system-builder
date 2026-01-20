import { useState, useEffect } from 'react';
import { IconClose } from '@salutejs/plasma-icons';
import { getRestoredColorFromPalette } from '@salutejs/plasma-tokens-utils';

import { getAlphaHex, numberFormatter } from '../../../../utils';
import {
    DesignSystem,
    ShadowToken,
    ShapeToken,
    SpacingToken,
    Theme,
} from '../../../../controllers';
import { ShadowPicker, ShadowType } from '../../../../features';
import { TextField } from '../../../../components';
import { TokenShapePreview } from '../TokenShapePreview';

import { Root, StyledHeader, StyledSetup, StyledLinkButton } from './TokenShapeEditor.styles';
import { getTokenValue } from './TokenShapeEditor.utils';

interface TokenShapeEditorProps {
    designSystem: DesignSystem;
    theme: Theme;
    tokens?: (ShadowToken | ShapeToken | SpacingToken)[];
    onTokenUpdate: () => void;
}

export const TokenShapeEditor = (props: TokenShapeEditorProps) => {
    const { designSystem, theme, tokens, onTokenUpdate } = props;

    const [value, setValue] = useState<string | ShadowType[]>('');

    const token = tokens?.[0];
    const [description, setDescription] = useState<string | undefined>(token?.getDescription());

    const updateTokenValue = (value: string | ShadowType[]) => {
        if (!token) {
            return;
        }

        if (token instanceof ShapeToken && typeof value === 'string') {
            token.setValue('web', `${parseFloat(value) / 16}rem`);
            token.setValue('ios', {
                kind: 'round',
                cornerRadius: parseFloat(value),
            });
            token.setValue('android', {
                kind: 'round',
                cornerRadius: parseFloat(value),
            });
        }

        if (token instanceof SpacingToken && typeof value === 'string') {
            token.setValue('web', `${parseFloat(value) / 16}rem`);
            token.setValue('ios', {
                value: parseFloat(value),
            });
            token.setValue('android', {
                value: parseFloat(value),
            });
        }

        // TODO: Перенести в utils
        if (token instanceof ShadowToken && typeof value === 'object') {
            const webValues = value.map(
                ({ offsetX, offsetY, blur, spread, color, opacity }) =>
                    `${parseFloat(offsetX) / 16}rem ${parseFloat(offsetY) / 16}rem ${parseFloat(blur) / 16}rem ${
                        parseFloat(spread) / 16
                    }rem ${getRestoredColorFromPalette(color)}${getAlphaHex(opacity)}`,
            );

            const nativeValues = value.map(({ offsetX, offsetY, blur, spread, color, opacity }, index) => ({
                color: `${getRestoredColorFromPalette(color)}${getAlphaHex(opacity)}`,
                offsetX: parseFloat(offsetX),
                offsetY: parseFloat(offsetY),
                blurRadius: parseFloat(blur),
                spreadRadius: parseFloat(spread),
                fallbackElevation: token.getValue('android')[index]?.fallbackElevation,
            }));

            token.setValue('web', webValues);
            token.setValue('ios', nativeValues);
            token.setValue('android', nativeValues);
        }

        onTokenUpdate();
    };

    const onValueChange = (newValue: string | ShadowType[]) => {
        if (typeof newValue === 'object') {
            setValue(newValue);

            updateTokenValue(newValue);
            return;
        }

        const prevValue = value as string;
        const formattedValue = numberFormatter(newValue, prevValue);

        if (!formattedValue) {
            return;
        }

        setValue(formattedValue);
        updateTokenValue(newValue);
    };

    const onDescriptionChange = (newDescription: string) => {
        if (!token) {
            return;
        }

        setDescription(newDescription);
        token.setDescription(newDescription);

        onTokenUpdate();
    };

    const onTokenReset = () => {
        if (!token) {
            return;
        }

        const tokenValue = getTokenValue(token.getDefaultValue('web'));
        setValue(tokenValue);
        setDescription(token.getDescription());
        setDescription(token.getDefaultDescription());
    };

    useEffect(() => {
        if (!token) {
            return;
        }

        const tokenValue = getTokenValue(token.getValue('web'));
        setValue(tokenValue);
        setDescription(token.getDescription());
    }, [token]);

    return (
        <Root>
            <StyledSetup>
                <StyledHeader>
                    <TextField readOnly value={token?.getDisplayName()} />
                    <TextField value={description} onChange={onDescriptionChange} />
                </StyledHeader>
                {(token?.getType() === 'shape' || token?.getType() === 'spacing') && typeof value === 'string' && (
                    <TextField label="Значение" hasBackground value={value} onChange={onValueChange} />
                )}
                {token?.getType() === 'shadow' && typeof value === 'object' && (
                    <ShadowPicker values={value} onChange={onValueChange} />
                )}
                <StyledLinkButton
                    text="Отменить изменения"
                    contentLeft={<IconClose size="xs" />}
                    onClick={onTokenReset}
                />
            </StyledSetup>
            <TokenShapePreview value={value} tokenType={token?.getType()} />
        </Root>
    );
};
