import { useState } from 'react';
import styled from 'styled-components';
import { IconButton, Select, TextField } from '@salutejs/plasma-b2c';
import { IconAddOutline } from '@salutejs/plasma-icons';

import type { Config } from '../../../componentBuilder';
import type { PropType } from '../../../componentBuilder/type';
import {
    ComponentTokenColor,
    ComponentTokenDimension,
    ComponentTokenFloat,
    ComponentTokenShape,
    ComponentTokenTypography,
} from './ComponentTokenType';
import type { Theme } from '../../../themeBuilder';

export const StyledRoot = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 1rem 0;
    gap: 0.5rem;
`;

export const StyledTextField = styled(TextField)`
    flex: 1;
`;

export const StyledSelect = styled(Select)`
    width: 100%;
` as typeof Select;

const getAllowedTokens = (config: Config, variationID?: string, styleID?: string) => {
    const tokens = config.getTokensByVariation(variationID);

    return tokens.filter((token) => {
        if (!variationID || !styleID) {
            const prop = config.getProp(token.id, config.getInvariants());

            return !prop;
        }

        const item = config.getStyle(variationID, styleID);
        const prop = config.getProp(token.id, item?.getProps());

        return !prop;
    });
};

interface ComponentAddTokenProps {
    config: Config;
    theme: Theme;
    variationID?: string;
    styleID?: string;
    newToken: string;
    setNewToken: (value: string) => void;
    updateConfig: () => void;
}

export const ComponentAddToken = (props: ComponentAddTokenProps) => {
    const { config, theme, variationID, styleID, newToken, setNewToken, updateConfig } = props;

    const [newTokenValue, setNewTokenValue] = useState<string>('');

    const [currentTokenType, setCurrentTokenType] = useState<PropType | undefined>();

    const allowedTokens = getAllowedTokens(config, variationID, styleID).map((item) => ({
        label: item.name,
        value: item.id,
        type: item.type,
    }));

    const onChangeTokenValue = (param: React.ChangeEvent<HTMLInputElement> | unknown) => {
        const value = (param as React.ChangeEvent<HTMLInputElement>).target?.value ?? param;
        setNewTokenValue(value);
    };

    const onChangeToken = (value: string, item: { type: PropType } | null) => {
        setNewToken(value);
        setCurrentTokenType(item?.type);
    };

    const onTokenAdd = () => {
        setNewToken('');
        setNewTokenValue('');
        setCurrentTokenType(undefined);

        config.addToken(newToken, newTokenValue, variationID, styleID);
        updateConfig();
    };

    return (
        <StyledRoot>
            <StyledSelect
                listOverflow="scroll"
                listMaxHeight="25"
                size="s"
                items={allowedTokens}
                value={newToken}
                onChange={onChangeToken}
            />
            {currentTokenType === 'color' && (
                <ComponentTokenColor value={newTokenValue} onChange={onChangeTokenValue} theme={theme} />
            )}
            {currentTokenType === 'shape' && (
                <ComponentTokenShape value={newTokenValue} onChange={onChangeTokenValue} theme={theme} />
            )}
            {currentTokenType === 'dimension' && (
                <ComponentTokenDimension value={newTokenValue} onChange={onChangeTokenValue} />
            )}
            {currentTokenType === 'float' && (
                <ComponentTokenFloat value={newTokenValue} onChange={onChangeTokenValue} />
            )}
            {currentTokenType === 'typography' && (
                <ComponentTokenTypography value={newTokenValue} onChange={onChangeTokenValue} theme={theme} />
            )}
            <IconButton view="clear" size="s" onClick={onTokenAdd}>
                <IconAddOutline />
            </IconButton>
        </StyledRoot>
    );
};
