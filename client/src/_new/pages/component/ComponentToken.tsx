import styled from 'styled-components';
import { IconButton, Indicator, TextS } from '@salutejs/plasma-b2c';
import { IconTrash, IconRotateCcw } from '@salutejs/plasma-icons';

import type { Config, PropUnion } from '../../../componentBuilder';
import {
    ComponentTokenColor,
    ComponentTokenDimension,
    ComponentTokenFloat,
    ComponentTokenShape,
    ComponentTokenTypography,
} from './ComponentTokenType';
import type { Theme } from '../../../themeBuilder';

const StyledRoot = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 1rem 0;
`;

const StyledTokenName = styled(TextS)`
    display: flex;
`;

const StyledTokenActions = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;
`;

interface ComponentTokenProps {
    item: PropUnion;
    config: Config;
    theme: Theme;
    variationID?: string;
    styleID?: string;
    updateConfig: () => void;
}

export const ComponentToken = (props: ComponentTokenProps) => {
    const { item, config, theme, variationID, styleID, updateConfig } = props;

    const tokenName = item.getName();
    const tokenID = item.getID();
    const tokenType = item.getType();
    const tokenValue = item.getValue();
    const tokenDefaultValue = item.getDefault() ?? '';
    const isTokenNotForWeb = !item.getWebTokens();

    const buttonResetView = tokenValue === tokenDefaultValue ? 'clear' : 'secondary';

    const onChange = (param: React.ChangeEvent<HTMLInputElement> | unknown) => {
        const value = (param as React.ChangeEvent<HTMLInputElement>).target?.value ?? param;

        config.updateToken(tokenID, value, variationID, styleID);
        updateConfig();
    };

    const onResetTokenValue = () => {
        config.updateToken(tokenID, tokenDefaultValue, variationID, styleID);
        updateConfig();
    };

    const onRemoveComponentProp = () => {
        config.removeToken(tokenID, variationID, styleID);
        updateConfig();
    };

    return (
        <StyledRoot>
            <StyledTokenName>
                {tokenName}
                {isTokenNotForWeb && <Indicator size="s" view="accent" />}
            </StyledTokenName>
            <StyledTokenActions>
                {tokenType === 'color' && <ComponentTokenColor value={tokenValue} onChange={onChange} theme={theme} />}
                {tokenType === 'shape' && <ComponentTokenShape value={tokenValue} onChange={onChange} theme={theme} />}
                {tokenType === 'dimension' && <ComponentTokenDimension value={tokenValue} onChange={onChange} />}
                {tokenType === 'float' && <ComponentTokenFloat value={tokenValue} onChange={onChange} />}
                {tokenType === 'typography' && (
                    <ComponentTokenTypography value={tokenValue} onChange={onChange} theme={theme} />
                )}
                <IconButton view={buttonResetView} size="s" onClick={() => onResetTokenValue()}>
                    <IconRotateCcw />
                </IconButton>
                <IconButton view="clear" size="s" onClick={() => onRemoveComponentProp()}>
                    <IconTrash />
                </IconButton>
            </StyledTokenActions>
        </StyledRoot>
    );
};
