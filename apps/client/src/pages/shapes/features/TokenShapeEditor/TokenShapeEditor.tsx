import { useState, useEffect } from 'react';
import { IconClose } from '@salutejs/plasma-icons';

import { numberFormatter, updateTokenChange } from '../../../../utils';
import { DesignSystem, ShadowToken, ShapeToken, SpacingToken, Theme } from '../../../../controllers';
import { ShadowPicker, ShadowType } from '../../../../features';
import { TextField } from '../../../../components';
import { shapeTokenActions } from '../../../../actions';
import { TokenShapePreview } from '../TokenShapePreview';

import { Root, StyledHeader, StyledSetup, StyledLinkButton } from './TokenShapeEditor.styles';
import { getTokenValue } from './TokenShapeEditor.utils';

interface TokenShapeEditorProps {
    designSystem: DesignSystem;
    theme: Theme;
    tokens?: (ShadowToken | ShapeToken | SpacingToken)[];
    rerender: () => void;
}

export const TokenShapeEditor = (props: TokenShapeEditorProps) => {
    const { designSystem, theme, tokens, rerender } = props;

    const [value, setValue] = useState<string | ShadowType[]>('');

    const token = tokens?.[0];
    const [description, setDescription] = useState<string | undefined>(token?.getDescription());

    const dsName = designSystem.getName() || '';
    const dsVersion = designSystem.getVersion() || '';

    const onValueChange = (newValue: string | ShadowType[]) => {
        const resolvedValue = typeof newValue === 'object'
            ? newValue
            : numberFormatter(newValue, value as string);

        if (!resolvedValue) {
            return;
        }

        setValue(resolvedValue);
        shapeTokenActions.updateToken({ value: resolvedValue, token, designSystem });
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

        const tokenValue = shapeTokenActions.resetToken({ token, designSystem });

        setValue(tokenValue);
        setDescription(token.getDefaultDescription());

        rerender();
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
                    <TextField
                        value={description}
                        maxWidth={286}
                        placeholder="Добавить описание"
                        onChange={onDescriptionChange}
                    />
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
