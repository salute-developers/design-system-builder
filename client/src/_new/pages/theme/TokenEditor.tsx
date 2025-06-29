import { type ChangeEvent, useState } from 'react';
import styled from 'styled-components';
import { TextField, Tabs, TabItem, TextArea, Switch, Button } from '@salutejs/plasma-b2c';

import { Token } from '../../../themeBuilder/tokens/token';
import { ColorToken, GradientToken, ShapeToken, SpacingToken } from '../../../themeBuilder';

import { ColorTokenEditor } from './ColorTokenEditor';
import { kebabToCamel } from '../../utils';

const platformTypes = [
    {
        label: 'Web',
        value: 'web',
        disabled: false,
    },
    {
        label: 'Android',
        value: 'android',
        disabled: true,
    },
    {
        label: 'iOS',
        value: 'ios',
        disabled: true,
    },
    // {
    //     label: 'React-Native',
    //     value: 'reactNative',
    //     disabled: true,
    // },
];

const StyledRoot = styled.div`
    display: flex;
    gap: 1rem;
    flex-direction: column;

    background: #121212;
    padding: 1rem;

    border-bottom-left-radius: 1rem;
    border-bottom-right-radius: 1rem;
`;

const StyledActions = styled.div`
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
`;

const getValue = (token: Token) => {
    if (token instanceof ColorToken) {
        return token.getValue('web');
    }

    if (token instanceof GradientToken) {
        return token.getValue('web').join('\n');
    }

    if (token instanceof ShapeToken) {
        return token.getValue('web');
    }

    if (token instanceof SpacingToken) {
        return token.getValue('web');
    }

    return JSON.stringify(token.getValue('web'), null, 4);
};

export const TokenEditor = ({
    token,
    readOnly,
    context,
    onTokenUpdate,
}: {
    token?: Token;
    readOnly?: boolean;
    context: string[];
    onTokenUpdate: (token?: Token, data?: any, context?: string[]) => void;
}) => {
    const tokenProps = {
        editableName: token ? kebabToCamel(token.getTags()[token.getTags().length - 1] || '') : '',
        description: token ? token.getDescription() : '',
        enabled: token ? token.getEnabled() : true,
        value: token ? getValue(token) : '',
    };

    const [tokenEditableName, setTokenEditableName] = useState(tokenProps.editableName);
    const [tokenDescription, setTokenDescription] = useState(tokenProps.description);
    const [tokenEnabled, setTokenEnabled] = useState(tokenProps.enabled);
    const [tokenValue, setTokenValue] = useState(tokenProps.value);

    const onTokenEditableNameChange = (event: ChangeEvent<HTMLInputElement>) => {
        setTokenEditableName(event.target.value);
    };

    const onTokenDescriptionChange = (event: ChangeEvent<HTMLInputElement>) => {
        setTokenDescription(event.target.value);
    };

    const onTokenEnabledChange = (event: ChangeEvent<HTMLInputElement>) => {
        setTokenEnabled(event.target.checked);
    };

    const onTokenValueChange = (value: string) => {
        setTokenValue(value);
    };

    const onUpdateCancel = () => {
        onTokenUpdate();
    };

    const onUpdateApply = () => {
        onTokenUpdate(
            token,
            {
                editableName: tokenEditableName,
                description: tokenDescription,
                enabled: tokenEnabled,
                value: tokenValue,
            },
            context,
        );
    };

    console.log('tokenValue', tokenValue);

    return (
        <StyledRoot>
            <TextField
                size="s"
                label="Название (в нотации camelCase)"
                value={tokenEditableName}
                onChange={onTokenEditableNameChange}
            />
            <TextField size="s" label="Описание" value={tokenDescription} onChange={onTokenDescriptionChange} />
            <Switch label="Отображать токен" checked={tokenEnabled} onChange={onTokenEnabledChange} />
            <Tabs view="divider" size="m">
                {platformTypes.map(({ label, disabled }, i) => (
                    <TabItem disabled={disabled} view="divider" key={`item_inner:${label}`} size="m" selected={i === 0}>
                        {label}
                    </TabItem>
                ))}
            </Tabs>

            {(context?.[0] === 'color' || token instanceof ColorToken) && (
                <ColorTokenEditor value={tokenValue} onChangeValue={onTokenValueChange} />
            )}
            {(context?.[0] === 'gradient' || token instanceof GradientToken) && (
                <TextArea
                    readOnly={readOnly}
                    size="s"
                    labelPlacement="outer"
                    label="Значение"
                    helperText="Если градиентов несколько, каждый новый необходимо добавлять на новой строке без запятых и прочих разделителей"
                    value={tokenValue}
                    onChange={(event) => onTokenValueChange(event.target.value)}
                />
            )}

            {token && !(token instanceof ColorToken || token instanceof GradientToken) && (
                <TextArea
                    readOnly={readOnly}
                    size="s"
                    labelPlacement="outer"
                    label="Значение"
                    value={tokenValue}
                    onChange={(event) => onTokenValueChange(event.target.value)}
                />
            )}

            <StyledActions>
                <Button view="clear" text="Назад" onClick={onUpdateCancel} />
                <Button view="accent" text="Сохранить" onClick={onUpdateApply} />
            </StyledActions>
        </StyledRoot>
    );
};
