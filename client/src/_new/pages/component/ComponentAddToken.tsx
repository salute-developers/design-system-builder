import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { IconButton, Select, TextField } from '@salutejs/plasma-b2c';
import { IconAddOutline } from '@salutejs/plasma-icons';

import type { Config } from '../../../componentBuilder';
import type { ComponentAPI, ComponentVariation, PropType } from '../../../componentBuilder/type';
import {
    ComponentTokenColor,
    ComponentTokenDimension,
    ComponentTokenFloat,
    ComponentTokenShape,
    ComponentTokenTypography,
} from './ComponentTokenType';
import type { Theme } from '../../../themeBuilder';
import type { DesignSystem } from '../../../designSystem';
import { useParams } from 'react-router-dom';

export const StyledRoot = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    gap: 0.5rem;
`;

export const StyledTextField = styled(TextField)`
    flex: 1;
`;

export const StyledSelect = styled(Select)`
    width: 100%;
` as typeof Select;

const getTokensByVariation = (api: ComponentAPI[], variations: ComponentVariation[], variationID?: string) => {
    if (!variationID) {
        return api.filter((item) => !item.variations);
    }

    const id = variations.find((variation) => variation.id === variationID)?.id || '';

    return api.filter((item) => item.variations?.find((item) => item === id));
};

const getAllowedTokens = (
    config: Config,
    api: ComponentAPI[],
    variations: ComponentVariation[],
    variationID?: string,
    styleID?: string,
) => {
    const tokens = getTokensByVariation(api, variations, variationID);

    return tokens.filter((token) => {
        const isVariationToken = variationID && styleID;

        const props = isVariationToken
            ? config.getStyleByVariation(variationID, styleID)?.getProps()
            : config.getInvariants();
        const prop = props?.getProp(token.id);

        return !prop;
    });
};

interface ComponentAddTokenProps {
    designSystem: DesignSystem;
    config: Config;
    theme: Theme;
    variationID?: string;
    styleID?: string;
    newToken: string;
    setNewToken: (value: string) => void;
    updateConfig: () => void;
}

export const ComponentAddToken = (props: ComponentAddTokenProps) => {
    const { componentName } = useParams();

    const { config, designSystem, theme, variationID, styleID, newToken, setNewToken, updateConfig } = props;

    const { api, variations } = useMemo(
        () => designSystem.getComponentDataByName(componentName).sources,
        [componentName],
    );

    const [newTokenValue, setNewTokenValue] = useState<string>('');

    const [currentTokenType, setCurrentTokenType] = useState<PropType | undefined>();

    const allowedTokens = getAllowedTokens(config, api, variations, variationID, styleID).map((item) => ({
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

        config.addToken(newToken, newTokenValue, api, variationID, styleID);
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
