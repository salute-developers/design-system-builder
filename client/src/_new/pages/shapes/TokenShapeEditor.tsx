import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { IconClose } from '@salutejs/plasma-icons';
import { backgroundTertiary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { getAlphaHex, getColorAndOpacity, numberFormatter } from '../../utils';
import {
    ShadowToken,
    ShapeToken,
    SpacingToken,
    Theme,
    WebShadowToken,
    WebShapeToken,
    WebSpacingToken,
} from '../../../themeBuilder';
import { DesignSystem } from '../../../designSystem';
import { ShadowPicker, ShadowType } from '../../features';
import { TextField, LinkButton } from '../../components';

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

const getTokenValue = (
    token: WebShadowToken[string] | WebShapeToken[string] | WebSpacingToken[string],
): string | ShadowType[] => {
    if (typeof token === 'string') {
        return `${parseFloat(token) * 16}`;
    }

    return token.map((shadow) => {
        const [offsetX, offsetY, blur, spread, ...value] = shadow.split(' ');
        const [color, opacity] = getColorAndOpacity(value.join(' '));

        return {
            offsetX: (parseFloat(offsetX) * 16).toString(),
            offsetY: (parseFloat(offsetY) * 16).toString(),
            blur: (parseFloat(blur) * 16).toString(),
            spread: (parseFloat(spread) * 16).toString(),
            color,
            opacity,
        };
    });
};

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

        if (token instanceof ShadowToken && typeof value === 'object') {
            const webValues = value.map(
                ({ offsetX, offsetY, blur, spread, color, opacity }) =>
                    `${parseFloat(offsetX) / 16}rem ${parseFloat(offsetY) / 16}rem ${parseFloat(blur) / 16}rem ${
                        parseFloat(spread) / 16
                    }rem ${color}${getAlphaHex(opacity)}`,
            );

            const nativeValues = value.map(({ offsetX, offsetY, blur, spread, color, opacity }, index) => ({
                color: `${color}${getAlphaHex(opacity)}`,
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
            <StyledHeader>
                <TextField readOnly value={token?.getDisplayName()} />
                <TextField value={description} onChange={onDescriptionChange} />
            </StyledHeader>
            <StyledSetup>
                {(token?.getType() === 'shape' || token?.getType() === 'spacing') && typeof value === 'string' && (
                    <TextField label="Значение" hasBackground value={value} onChange={onValueChange} />
                )}
                {token?.getType() === 'shadow' && typeof value === 'object' && (
                    <ShadowPicker values={value} onChange={onValueChange} />
                )}
            </StyledSetup>
            <StyledLinkButton text="Отменить изменения" contentLeft={<IconClose size="xs" />} onClick={onTokenReset} />
        </Root>
    );
};
