import { MouseEvent, useState } from 'react';
import { IconDotsHorizontalOutline, IconPlus } from '@salutejs/plasma-icons';
import { upperFirstLetter } from '@salutejs/plasma-tokens-utils';

import { DesignSystem, Config } from '../../../../controllers';
import { IconButton, TextField } from '../../../../components';

import {
    Root,
    List,
    ListSectionTitle,
    ListItem,
    ListItemWrapper,
    ListItemText,
    ListItemOption,
    ListItemContentRight,
    StyledDropdown,
} from './ComponentEditorSetup.styles';
import { getVariations, variationMap, styleMenuList, StyleMenuItem } from './ComponentEditorSetup.utils';

interface ComponentEditorSetupProps {
    config: Config;
    designSystem: DesignSystem;
    variationID?: string;
    styleID?: string;
    onVariationChange: (value: string) => void;
    onStyleChange: (value: string) => void;
    onConfigUpdate: () => void;
}

export const ComponentEditorSetup = (props: ComponentEditorSetupProps) => {
    const { config, designSystem, variationID, styleID, onVariationChange, onStyleChange, onConfigUpdate } = props;

    const [styleIDWithDropdown, setStyledIDWithDropdown] = useState<string | undefined>();
    const [variationIDWithCreating, setSelectedVariationWithCreating] = useState<string | undefined>(undefined);
    const [creatingStyleName, setCreatingStyleName] = useState<string>('');

    const variationList = getVariations(config);
    const styleList = variationList.find((item) => item.value === variationID)?.inner;

    const onStyleMenuSelect = (item: StyleMenuItem, styleID: string) => {
        if (item.value === 'set_style_default' && variationID) {
            config.updateDefaults(variationID, styleID);
        }

        if (item.value === 'delete_style') {
            config.removeVariationStyle(variationID, styleID);
        }

        onConfigUpdate();
    };

    const onStyleMenuOpen = (styleID: string) => (event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();

        setStyledIDWithDropdown(styleID);
    };

    const onStyleMenuClose = () => {
        setStyledIDWithDropdown(undefined);
    };

    const onStyleAdd = (variationID?: string) => {
        setSelectedVariationWithCreating(variationID);
    };

    const onStyleAddChange = (value: string) => {
        const newValue = value.replace(/[^a-zA-Z0-9]/g, '');

        setCreatingStyleName(newValue);
    };

    const onStyleAddCommit = (tokenName: string) => {
        setSelectedVariationWithCreating(undefined);
        setCreatingStyleName('');

        if (!variationID) {
            return;
        }

        const { api } = designSystem.getComponentDataByName(config.getName()).sources;
        config.addVariationStyle(api, variationID, tokenName);

        onConfigUpdate();
    };

    const onStyleAddCancel = () => {
        setSelectedVariationWithCreating(undefined);
        setCreatingStyleName('');
    };

    return (
        <Root>
            <List>
                <ListSectionTitle>Вариации</ListSectionTitle>
                {variationList.map(({ label, value }, index) => (
                    <ListItem
                        selected={value === variationID || (variationID === undefined && value === 'invariants')}
                        onClick={() => onVariationChange(value)}
                        key={`${value}_${index}`}
                    >
                        <ListItemText>{variationMap[label]}</ListItemText>
                    </ListItem>
                ))}
            </List>
            {Boolean(styleList?.length) && (
                <List>
                    <ListItemWrapper>
                        <ListSectionTitle>Стили</ListSectionTitle>
                        <ListItemContentRight>
                            <IconButton onClick={() => onStyleAdd(variationID)}>
                                <IconPlus size="xs" color="inherit" />
                            </IconButton>
                        </ListItemContentRight>
                    </ListItemWrapper>
                    {styleList?.map(({ label, value: selectedStyle, isDefault }) => (
                        <ListItem
                            key={`item_inner:${label}`}
                            selected={styleID === selectedStyle}
                            onClick={() => onStyleChange(selectedStyle)}
                        >
                            <ListItemWrapper>
                                <ListItemText>{upperFirstLetter(label)}</ListItemText>
                                {isDefault && <ListItemOption>по умолчанию</ListItemOption>}
                            </ListItemWrapper>
                            <ListItemContentRight>
                                <IconButton onClick={onStyleMenuOpen(selectedStyle)}>
                                    <IconDotsHorizontalOutline size="xs" color="inherit" />
                                </IconButton>
                            </ListItemContentRight>
                            {styleIDWithDropdown === selectedStyle && (
                                <StyledDropdown
                                    autoAlign={false}
                                    items={styleMenuList}
                                    onItemSelect={(value) => onStyleMenuSelect(value as StyleMenuItem, selectedStyle)}
                                    onClose={onStyleMenuClose}
                                />
                            )}
                        </ListItem>
                    ))}
                    {variationIDWithCreating === variationID && (
                        <TextField
                            hasBackground
                            stretched
                            autoFocus
                            value={creatingStyleName}
                            onChange={onStyleAddChange}
                            onCommit={onStyleAddCommit}
                            onBlur={onStyleAddCancel}
                        />
                    )}
                </List>
            )}
        </Root>
    );
};
