import { Fragment, MouseEvent, useMemo, useState } from 'react';
import { upperFirstLetter } from '@salutejs/plasma-tokens-utils';
import { IconDotsHorizontalOutline, IconPlus } from '@salutejs/plasma-icons';

import { DesignSystem, Theme, Config, PropType, PropState, PropUnion, State } from '../../../../controllers';
import { SelectButtonItem, TextField, IconButton } from '../../../../components';

import {
    Root,
    StyledPropsGroupName,
    StyledPropList,
    StyledProp,
    StyledPropFields,
    StyledPropContentRight,
    StyledSelectButton,
    StyledDropdown,
    StyledPropLabel,
    StyledStatePropLabel,
} from './ComponentEditorProperties.styles';
import {
    getPropList,
    getAllowedProps,
    propTypeMap,
    getColorsTokens,
    getColorStateTokens,
    colorStates,
    getShapesTokens,
    getShadowsTokens,
    getTypographyTokens,
    getPropMenuList,
    ADD_STATE_ACTION,
    REMOVE_STATE_ACTION,
    PropMenuItem,
} from './ComponentEditorProperties.utils';

interface RenderComponentPropParams {
    prop: PropUnion;
    theme: Theme;
    onChange: (param: SelectButtonItem | string) => void;
    onStateChange: (state: PropState) => (param: SelectButtonItem | string) => void;
}

const renderComponentProp = ({ prop, theme, onChange, onStateChange }: RenderComponentPropParams) => {
    const propType = prop.getType();
    const propValue = prop.getValue();
    const propName = upperFirstLetter(prop.getName());

    const getItems = (propType: PropType) => {
        if (propType === 'shape') {
            return getShapesTokens(theme);
        }

        if (propType === 'color') {
            return getColorsTokens(theme);
        }

        if (propType === 'typography') {
            return getTypographyTokens(theme);
        }

        if (propType === 'shadow') {
            return getShadowsTokens(theme);
        }

        return [];
    };

    if (propType === 'color') {
        const items = getItems(propType);
        const selectedItem = items.find((item) => item.value === propValue);
        const states = prop.getStates() ?? [];

        return (
            <StyledPropFields>
                <StyledSelectButton
                    hasSearch
                    autoAlign={false}
                    label={<StyledPropLabel>{propName}</StyledPropLabel>}
                    items={items}
                    selected={selectedItem}
                    onItemSelect={onChange}
                />
                {colorStates
                    .filter(({ state }) => states.some((item) => item.state[0] === state))
                    .map(({ state, label, suffix }) => {
                        const stateItems = getColorStateTokens(suffix, theme);
                        const stateValue = states.find((item) => item.state[0] === state)?.value;
                        const selectedStateItem = stateItems.find((item) => item.value === stateValue);

                        return (
                            <StyledSelectButton
                                key={`state_${state}`}
                                hasSearch
                                autoAlign={false}
                                label={<StyledStatePropLabel>{label}</StyledStatePropLabel>}
                                items={stateItems}
                                selected={selectedStateItem}
                                onItemSelect={onStateChange(state)}
                            />
                        );
                    })}
            </StyledPropFields>
        );
    }

    if (propType === 'shape' || propType === 'typography' || propType === 'shadow') {
        const items = getItems(propType);
        const selectedItem = items.find((item) => item.value === propValue);

        return (
            <StyledSelectButton
                hasSearch
                autoAlign={false}
                label={<StyledPropLabel>{propName}</StyledPropLabel>}
                items={items}
                selected={selectedItem}
                onItemSelect={onChange}
            />
        );
    }

    if (propType === 'float' || propType === 'dimension') {
        return (
            <TextField
                stretched
                hasBackground
                label={<StyledPropLabel>{propName}</StyledPropLabel>}
                value={propValue as string}
                onChange={onChange}
            />
        );
    }

    return null;
};

interface ComponentEditorPropertiesProps {
    config: Config;
    updated: object;
    designSystem: DesignSystem;
    theme: Theme;
    variationID?: string;
    styleID?: string;
    onConfigUpdate: () => void;
}

export const ComponentEditorProperties = (props: ComponentEditorPropertiesProps) => {
    const { config, designSystem, theme, variationID, styleID, updated, onConfigUpdate } = props;

    const [propTypeWithDropdown, setPropTypeWithDropdown] = useState<string | undefined>();
    const [propNameWithDropdown, setPropNameWithDropdown] = useState<string | undefined>();

    const { api, variations } = useMemo(
        () => designSystem.getComponentDataByName(config?.getName() || '').sources,
        [config, designSystem],
    );

    const propList = useMemo(
        () => getPropList(config, api, variations, variationID, styleID),
        [updated, config, variationID, styleID],
    );

    const allowedProps = useMemo(
        () =>
            getAllowedProps(config, api, variations, variationID, styleID)
                .filter((item) => propTypeMap[item.type] === propTypeWithDropdown)
                .map((item) => ({
                    label: item.name,
                    value: item.id,
                    type: item.type,
                })),
        [propTypeWithDropdown, updated, config, variationID, styleID],
    );

    const onPropValueChange = (prop: PropUnion) => (param: SelectButtonItem | string) => {
        const propID = prop.getID();
        const value = typeof param === 'string' ? param : param.value;

        config.updateToken(propID, value, variationID, styleID);

        onConfigUpdate();
    };

    const onPropStateChange = (prop: PropUnion) => (state: PropState) => (param: SelectButtonItem | string) => {
        const propID = prop.getID();
        const value = typeof param === 'string' ? param : param.value;

        const hasState = prop.getStates()?.some((item) => item.state[0] === state);
        const newState: State = { state: [state], value };

        if (hasState) {
            config.updateTokenState(propID, state, newState, variationID, styleID);
        } else {
            config.addTokenState(propID, newState, variationID, styleID);
        }

        onConfigUpdate();
    };

    const onPropTypeMenuSelect = (item: (typeof allowedProps)[number]) => {
        config.addToken(item.value, undefined as any, api, variationID, styleID);

        onConfigUpdate();
    };

    const onPropTypeMenuOpen = (value: string) => (event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();

        setPropTypeWithDropdown(value);
    };

    const onPropTypeMenuClose = () => {
        setPropTypeWithDropdown(undefined);
    };

    const onPropMenuSelect = (item: PropMenuItem, prop: PropUnion) => {
        const propID = prop.getID();
        const propDefaultValue = prop.getDefault();

        if (item.value === 'reset_prop' && variationID && propDefaultValue) {
            config.updateToken(propID, propDefaultValue, variationID, styleID);
        }

        if (item.value === 'delete_prop') {
            config.removeToken(propID, variationID, styleID);
        }

        if (item.value.startsWith(`${ADD_STATE_ACTION}:`)) {
            const [, state] = item.value.split(':');
            const suffix = colorStates.find((s) => s.state === state)?.suffix;
            const propValue = prop.getValue();

            const value =
                suffix && typeof propValue === 'string' ? `${propValue}${suffix}` : undefined;

            config.addTokenState(propID, { state: [state as PropState], value }, variationID, styleID);
        }

        if (item.value.startsWith(`${REMOVE_STATE_ACTION}:`)) {
            const [, state] = item.value.split(':');

            config.removeTokenState(propID, state, variationID, styleID);
        }

        onConfigUpdate();
    };

    const onPropMenuOpen = (value: string) => (event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();

        setPropNameWithDropdown(value);
    };

    const onPropMenuClose = () => {
        setPropNameWithDropdown(undefined);
    };

    return (
        <Root>
            {propList.map((item) => (
                <Fragment key={`type_${item.type}`}>
                    <StyledPropsGroupName>
                        {item.type}
                        <StyledPropContentRight>
                            <IconButton onClick={onPropTypeMenuOpen(item.type)}>
                                <IconPlus size="xs" color="inherit" />
                            </IconButton>
                        </StyledPropContentRight>
                        {propTypeWithDropdown === item.type && (
                            <StyledDropdown
                                autoAlign={false}
                                items={allowedProps}
                                onItemSelect={(value) => onPropTypeMenuSelect(value as (typeof allowedProps)[number])}
                                onClose={onPropTypeMenuClose}
                            />
                        )}
                    </StyledPropsGroupName>
                    <StyledPropList>
                        {item.props.map((prop) => (
                            <StyledProp key={`prop_${prop.getName()}`}>
                                {renderComponentProp({
                                    prop,
                                    theme,
                                    onChange: onPropValueChange(prop),
                                    onStateChange: onPropStateChange(prop),
                                })}
                                <StyledPropContentRight canShow={propNameWithDropdown === prop.getName()}>
                                    <IconButton onClick={onPropMenuOpen(prop.getName())}>
                                        <IconDotsHorizontalOutline size="xs" color="inherit" />
                                    </IconButton>
                                    {propNameWithDropdown === prop.getName() && (
                                        <StyledDropdown
                                            autoAlign={false}
                                            items={getPropMenuList(prop)}
                                            onItemSelect={(value) => onPropMenuSelect(value as PropMenuItem, prop)}
                                            onClose={onPropMenuClose}
                                        />
                                    )}
                                </StyledPropContentRight>
                            </StyledProp>
                        ))}
                    </StyledPropList>
                </Fragment>
            ))}
        </Root>
    );
};
