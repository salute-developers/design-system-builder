import styled from 'styled-components';
import { IconButton, Indicator, TextField, TextS } from '@salutejs/plasma-b2c';
import { IconTrash, IconRotateCcw, IconChevronDown } from '@salutejs/plasma-icons';

import type { Config, PropState, PropType, PropUnion } from '../../../componentBuilder';
import {
    ComponentTokenColor,
    ComponentTokenDimension,
    ComponentTokenFloat,
    ComponentTokenShape,
    ComponentTokenTypography,
} from './ComponentTokenType';
import type { Theme } from '../../../themeBuilder';
import { useState } from 'react';
import { ComponentAddTokenState } from './ComponentAddTokenState';

const StyledRoot = styled.div``;

const StyledToken = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
`;

const StyledTokenName = styled(TextS)`
    display: flex;
`;

const StyledTokenActions = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;
`;

const StyledAdditionalContent = styled.div`
    background: #28262670;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
`;

const StyledAdjustment = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
`;

const StyledAdjustmentTextField = styled(TextField)`
    min-width: 22rem;
`;

interface ComponentTokenProps {
    item: PropUnion;
    config: Config;
    theme: Theme;
    variationID?: string;
    styleID?: string;
    updateConfig: () => void;
}

const renderComponentToken = (
    tokenType: PropType | undefined,
    tokenValue: string | number | undefined,
    onChange: (param: React.ChangeEvent<HTMLInputElement> | unknown) => void,
    theme: Theme,
) => {
    switch (tokenType) {
        case 'color':
            return <ComponentTokenColor value={tokenValue} onChange={onChange} theme={theme} />;
        case 'shape':
            return <ComponentTokenShape value={tokenValue} onChange={onChange} theme={theme} />;
        case 'dimension':
            return <ComponentTokenDimension value={tokenValue} onChange={onChange} />;
        case 'float':
            return <ComponentTokenFloat value={tokenValue} onChange={onChange} />;
        case 'typography':
            return <ComponentTokenTypography value={tokenValue} onChange={onChange} theme={theme} />;
        default:
            return null;
    }
};

export const ComponentToken = (props: ComponentTokenProps) => {
    const { item, config, theme, variationID, styleID, updateConfig } = props;

    const [isOpenAdditional, setIsOpenAdditional] = useState(false);

    const tokenName = item.getName();
    const tokenID = item.getID();
    const tokenType = item.getType();
    const tokenValue = item.getValue();
    const tokenStates = item.getStates();
    const tokenAdjustment = item.getAdjustment() ?? '';
    const tokenDefaultValue = item.getDefault() ?? '';

    const isTokenNotForWeb = !item.getWebTokens();
    const buttonResetView = tokenValue === tokenDefaultValue ? 'clear' : 'secondary';
    const buttonOpenAdditionalDisabled =
        tokenType === 'typography' || tokenType === 'dimension' || tokenType === 'float';

    const onChangeTokenValue = (param: React.ChangeEvent<HTMLInputElement> | unknown) => {
        const value = (param as React.ChangeEvent<HTMLInputElement>).target?.value ?? param;

        config.updateToken(tokenID, value, variationID, styleID);
        updateConfig();
    };

    const onResetTokenValue = () => {
        config.updateToken(tokenID, tokenDefaultValue, variationID, styleID);
        updateConfig();
    };

    const onRemoveToken = () => {
        config.removeToken(tokenID, variationID, styleID);
        updateConfig();
    };

    const onOpenAdditional = () => {
        setIsOpenAdditional(!isOpenAdditional);
    };

    const onChangeTokenAdjustment = (param: React.ChangeEvent<HTMLInputElement>) => {
        const value = param.target?.value;

        if (!value.match(/^-?\d*$/gim)) {
            return;
        }

        config.updateTokenAdjustment(tokenID, value, variationID, styleID);
        updateConfig();
    };

    const onClearTokenAdjustment = () => {
        config.updateTokenAdjustment(tokenID, undefined, variationID, styleID);
        updateConfig();
    };

    const onChangeTokenState = (name: string) => (param: React.ChangeEvent<HTMLInputElement> | unknown) => {
        const value = (param as React.ChangeEvent<HTMLInputElement>).target?.value ?? param;
        const stateValue = {
            // TODO: поддержать работу с несколькими стейтами
            state: [name as PropState],
            value,
        };

        config.updateTokenState(tokenID, name, stateValue, variationID, styleID);
        updateConfig();
    };

    const onRemoveTokenState = (name: string) => {
        config.removeTokenState(tokenID, name, variationID, styleID);
        updateConfig();
    };

    return (
        <StyledRoot>
            <StyledToken>
                <StyledTokenName>
                    {tokenName}
                    {isTokenNotForWeb && <Indicator size="s" view="accent" />}
                </StyledTokenName>
                <StyledTokenActions>
                    {renderComponentToken(tokenType, tokenValue, onChangeTokenValue, theme)}
                    <IconButton
                        view="clear"
                        size="s"
                        disabled={buttonOpenAdditionalDisabled}
                        onClick={onOpenAdditional}
                    >
                        <IconChevronDown />
                    </IconButton>
                    <IconButton view={buttonResetView} size="s" onClick={onResetTokenValue}>
                        <IconRotateCcw />
                    </IconButton>
                    <IconButton view="clear" size="s" onClick={onRemoveToken}>
                        <IconTrash />
                    </IconButton>
                </StyledTokenActions>
            </StyledToken>
            {isOpenAdditional && (
                <StyledAdditionalContent>
                    {tokenType === 'shape' && (
                        <StyledToken>
                            <StyledTokenName>Корректировка</StyledTokenName>
                            <StyledAdjustment>
                                <StyledAdjustmentTextField
                                    size="s"
                                    value={tokenAdjustment}
                                    onChange={onChangeTokenAdjustment}
                                />
                                <StyledTokenActions>
                                    <IconButton view="clear" size="s" onClick={onClearTokenAdjustment}>
                                        <IconTrash />
                                    </IconButton>
                                </StyledTokenActions>
                            </StyledAdjustment>
                        </StyledToken>
                    )}
                    {tokenStates?.map(({ value, state: [name] }) => (
                        <StyledToken>
                            <StyledTokenName>Состояние {name}</StyledTokenName>
                            <StyledTokenActions>
                                {renderComponentToken(tokenType, value, onChangeTokenState(name), theme)}
                                <IconButton view="clear" size="s" onClick={() => onRemoveTokenState(name)}>
                                    <IconTrash />
                                </IconButton>
                            </StyledTokenActions>
                        </StyledToken>
                    ))}
                    {tokenType === 'color' && (
                        <ComponentAddTokenState
                            config={config}
                            tokenID={tokenID}
                            variationID={variationID}
                            styleID={styleID}
                            tokenStates={tokenStates}
                            updateConfig={updateConfig}
                        />
                    )}
                </StyledAdditionalContent>
            )}
        </StyledRoot>
    );
};
