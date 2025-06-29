import { useState } from 'react';
import styled from 'styled-components';
import { IconButton, Select, TextField } from '@salutejs/plasma-b2c';
import { IconAddOutline } from '@salutejs/plasma-icons';

import type { Config } from '../../../componentBuilder';
import type { PropState, State } from '../../../componentBuilder/type';

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

const getAllowedStates = (tokenStates?: State[] | null) => {
    const states = ['hovered', 'pressed'];

    return states
        ?.filter((state) => !tokenStates?.find(({ state: [name] }) => state === name))
        .map((state) => ({
            label: `Добавить состояние ${state}`,
            value: state,
        }));
};

interface ComponentAddTokenStateProps {
    config: Config;
    tokenID: string;
    variationID?: string;
    styleID?: string;
    tokenStates?: State[] | null;
    updateConfig: () => void;
}

export const ComponentAddTokenState = (props: ComponentAddTokenStateProps) => {
    const { config, tokenID, variationID, styleID, tokenStates, updateConfig } = props;

    const [newState, setNewState] = useState<string>('');

    const allowedStates = getAllowedStates(tokenStates);

    const onChangeNewState = (value: string) => {
        setNewState(value);
    };

    const onAddTokenState = () => {
        if (!newState) {
            return;
        }

        setNewState('');

        const stateValue = {
            // TODO: поддержать работу с несколькими стейтами
            state: [newState as PropState],
            value: undefined,
        };

        config.addTokenState(tokenID, stateValue, variationID, styleID);
        updateConfig();
    };

    return (
        <StyledRoot>
            <StyledSelect
                listOverflow="scroll"
                listMaxHeight="25"
                size="s"
                items={allowedStates}
                value={newState}
                onChange={onChangeNewState}
            />
            <IconButton view="clear" size="s" onClick={onAddTokenState}>
                <IconAddOutline />
            </IconButton>
        </StyledRoot>
    );
};
