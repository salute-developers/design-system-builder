import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { IconClose } from '@salutejs/plasma-icons';
import { backgroundTertiary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { ShadowToken, ShapeToken, SpacingToken, Theme } from '../../../themeBuilder';
import { Token } from '../../../themeBuilder/tokens/token';
import { DesignSystem } from '../../../designSystem';
import { TextField } from '../../components/TextField';
import { TextArea } from '../../components/TextArea';
import { ShadowPicker, ShadowType } from '../../components/ShadowPicker';
import { LinkButton } from '../../components/LinkButton';
import { getColorAndOpacity } from '../../utils';

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
    height: calc(100% - 10rem);

    // TODO: подумать как это обойти
    // overflow-y: scroll;
    // overflow-x: hidden;

    display: flex;
    flex-direction: column;
    gap: 0.75rem;
`;

const StyledLinkButton = styled(LinkButton)`
    position: absolute;
    bottom: 3rem;
`;

const getTokenValue = (token: ShadowToken | ShapeToken | SpacingToken): string | ShadowType[] => {
    if (token instanceof ShapeToken || token instanceof SpacingToken) {
        return `${parseInt(token.getValue('web')) * 16}`;
    }

    return token.getValue('web').map((shadow) => {
        const [offsetX, offsetY, blur, spread, ...value] = shadow.split(' ');
        const [color, opacity] = getColorAndOpacity(value.join(' '));

        return {
            offsetX: parseInt(offsetX).toString(),
            offsetY: parseInt(offsetY).toString(),
            blur: parseInt(blur).toString(),
            spread: parseInt(spread).toString(),
            color,
            opacity,
        };
    });
};

interface TokenShapeEditorProps {
    designSystem: DesignSystem;
    theme: Theme;
    tokens?: Token[];
}

export const TokenShapeEditor = (props: TokenShapeEditorProps) => {
    const { designSystem, theme, tokens } = props;

    const [value, setValue] = useState<string | ShadowType[]>('');

    const token = tokens?.[0];

    const onValueChange = (value: string | ShadowType[]) => {
        if (typeof value === 'object') {
            setValue(value);
            return;
        }

        const inputValue = value.replace(/(?!^-)[^\d]/g, '');
        let newValue = parseInt(inputValue, 10);

        if (inputValue === '' || isNaN(newValue)) {
            newValue = 0;
        }

        setValue(newValue.toString());
    };

    useEffect(() => {
        if (!token) {
            return;
        }

        const tokenValue = getTokenValue(token);

        setValue(tokenValue);
    }, [token]);

    return (
        <Root>
            <StyledHeader>
                <TextField readOnly value={token?.getDisplayName()} />
                <TextArea value={token?.getDescription()} />
            </StyledHeader>
            <StyledSetup>
                {(token?.getType() === 'shape' || token?.getType() === 'spacing') && typeof value === 'string' && (
                    <TextField label="Значение" hasBackground value={value} textAfter="px" onChange={onValueChange} />
                )}
                {token?.getType() === 'shadow' && typeof value === 'object' && (
                    <ShadowPicker values={value} onChange={onValueChange} />
                )}
            </StyledSetup>
            <StyledLinkButton text="Отменить изменения" contentLeft={<IconClose size="xs" />} />
        </Root>
    );
};
