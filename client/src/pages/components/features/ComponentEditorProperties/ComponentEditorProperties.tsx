import { Fragment, MouseEvent, useMemo, useState } from 'react';
import { upperFirstLetter } from '@salutejs/plasma-tokens-utils';
import { IconDotsHorizontalOutline, IconPlus } from '@salutejs/plasma-icons';

import { DesignSystem, Theme, Config, PropType, PropUnion } from '../../../../controllers';
import { SelectButtonItem, TextField, IconButton } from '../../../../components';

import {
    Root,
    StyledPropsGroupName,
    StyledPropList,
    StyledProp,
    StyledPropContentRight,
    StyledSelectButton,
    StyledDropdown,
    StyledPropLabel,
} from './ComponentEditorProperties.styles';
import {
    getPropList,
    getAllowedProps,
    propTypeMap,
    getColorsTokens,
    getShapesTokens,
    getTypographyTokens,
    propMenuList,
    PropMenuItem,
} from './ComponentEditorProperties.utils';

const renderComponentProp = (prop: PropUnion, onChange: (param: SelectButtonItem | string) => void, theme: Theme) => {
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

        return [];
    };

    if (propType === 'shape' || propType === 'color' || propType === 'typography') {
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
                                {renderComponentProp(prop, onPropValueChange(prop), theme)}
                                <StyledPropContentRight canShow={propNameWithDropdown === prop.getName()}>
                                    <IconButton onClick={onPropMenuOpen(prop.getName())}>
                                        <IconDotsHorizontalOutline size="xs" color="inherit" />
                                    </IconButton>
                                    {propNameWithDropdown === prop.getName() && (
                                        <StyledDropdown
                                            autoAlign={false}
                                            items={propMenuList}
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
