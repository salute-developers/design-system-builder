import { Fragment, MouseEvent, useEffect, useState } from 'react';
import { IconEyeClosedOutline, IconEyeOutline, IconPlus, IconSearch } from '@salutejs/plasma-icons';
import { lowerFirstLetter } from '@salutejs/plasma-tokens-utils';

import { Data } from '../../types';
import { Config, Token } from '../../controllers';
import { IconButton, TextField, Tooltip } from '../../components';
import { canShowTooltip, getDefaultDisabledGroups } from './Menu.utils';
import {
    Header,
    HeaderContent,
    HeaderSubtitle,
    HeaderTitle,
    List,
    ListItem,
    ListItemColorPreview,
    ListItemContentRight,
    ListItemPreviewWrapper,
    ListItems,
    ListItemShapePreview,
    ListItemText,
    ListItemTypographyPreview,
    ListItemWrapper,
    ListSectionGroup,
    ListSectionGroups,
    ListSectionGroupToggle,
    ListSectionTitle,
    Root,
    StyledIconChevronDown,
    StyledIconChevronUp,
} from './Menu.styles';

export interface MenuProps {
    header?: string;
    subheader?: string;
    data: Data;
    selectedItemIndexes?: [number, number, number];
    sectionTitle?: string;
    canDisable?: boolean;
    canAdd?: boolean;
    onTabSelect?: (index: number) => void;
    onItemSelect?: (groupIndex: number, itemIndex: number) => void;
    onItemAdd?: (groupName: string, itemName: string, tabName?: string, items?: (Token | Config)[]) => void;
    onItemDisable?: (items: (Token | Config)[], disabled: boolean) => void;
}

export const Menu = (props: MenuProps) => {
    const {
        header,
        subheader,
        data,
        selectedItemIndexes,
        sectionTitle = 'Токены',
        canAdd = true,
        canDisable = true,
        onTabSelect,
        onItemSelect,
        onItemAdd,
        onItemDisable,
    } = props;

    const { groups, tabs } = data;

    const [tabIndex = 0, groupIndex = 0, itemIndex = 0] = selectedItemIndexes || [];

    const [selectedTab, setSelectedTab] = useState<string | undefined>(tabs?.values[tabIndex]);
    const [groupsData, setGroupsData] = useState(data.groups[tabIndex].data);
    const [openedGroups, setOpenedGroups] = useState<string[]>([groupsData[groupIndex].name]);
    const [disabledGroups, setDisabledGroups] = useState<string[]>(getDefaultDisabledGroups(groupsData));
    const [selectedItem, setSelectedItem] = useState(groupsData[groupIndex].items[itemIndex].name);
    const [groupNameWithItemCreating, setGroupNameWithItemCreating] = useState<string | undefined>(undefined);
    const [creatingItemName, setCreatingItemName] = useState<string>('NewItem');

    const onTabValueSelect = (value: string) => {
        setSelectedTab(value);

        const groupIndex = groups.findIndex((group) => group.value === value);

        if (groupIndex === -1) {
            return;
        }

        if (onTabSelect) {
            onTabSelect(groupIndex);
        }
    };

    const onGroupToggle = (name: string) => {
        const newOpenedGroups = openedGroups.includes(name)
            ? openedGroups.filter((item) => item !== name)
            : [...openedGroups, name];

        setOpenedGroups(newOpenedGroups);
    };

    const onItemPlusButtonClick = (groupName: string) => (event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();

        setGroupNameWithItemCreating(groupName);
    };

    const onItemAddChange = (value: string) => {
        let newValue = value.replace(/[^a-zA-Z0-9]/g, '');

        if (newValue.length > 0) {
            newValue = newValue.charAt(0).toUpperCase() + newValue.slice(1);
        }

        setCreatingItemName(newValue);
    };

    const onItemAddCommit = (groupName: string, itemName: string, tabName?: string) => {
        setGroupNameWithItemCreating(undefined);
        setCreatingItemName('');

        if (onItemAdd) {
            const groupIndex = groupsData.findIndex(({ name }) => name === groupNameWithItemCreating);
            const items = groupsData[groupIndex].items?.[0].data;

            onItemAdd(groupName, itemName, tabName, items);
        }
    };

    const onItemAddCancel = () => {
        setGroupNameWithItemCreating(undefined);
        setCreatingItemName('');
    };

    const onItemGroupDisable = (name: string) => (event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();

        const groupIndex = groupsData.findIndex((group) => group.name === name);
        const isDisabled = disabledGroups.includes(name);

        const updatedGroupsData = [...groupsData];
        updatedGroupsData[groupIndex].items.forEach((item) => {
            item.disabled = !isDisabled;
        });

        if (onItemDisable) {
            const items = updatedGroupsData[groupIndex].items.map(({ data }) => data).flat();
            onItemDisable(items, isDisabled);
        }

        setGroupsData(updatedGroupsData);

        const newDisabledGroups = isDisabled
            ? disabledGroups.filter((item) => item !== name)
            : [...disabledGroups, name];

        setDisabledGroups(newDisabledGroups);
    };

    const onItemClick =
        (
            name: string,
            disabled: boolean,
            groupIndex: number,
            itemIndex: number,
            items: (Token | Config)[],
            groupName: string,
            itemName: string,
        ) =>
        (event: MouseEvent<HTMLDivElement>) => {
            if (disabled) {
                onItemDisabledButtonClick(groupName, itemName, items, disabled)(event);
                return;
            }

            setSelectedItem(name);

            if (onItemSelect) {
                onItemSelect(groupIndex, itemIndex);
            }
        };

    const onItemDisabledButtonClick =
        (groupName: string, itemName: string, items: (Token | Config)[], disabled: boolean) =>
        (event: MouseEvent<HTMLDivElement>) => {
            event.stopPropagation();

            const groupIndex = groupsData.findIndex((group) => group.name === groupName);
            const itemIndex = groupsData[groupIndex].items.findIndex((item) => item.name === itemName);

            const updatedGroupsData = [...groupsData];
            updatedGroupsData[groupIndex].items[itemIndex].disabled = !disabled;

            if (onItemDisable) {
                onItemDisable(items, disabled);
            }

            setGroupsData(updatedGroupsData);

            if (updatedGroupsData[groupIndex].items.every(({ disabled }) => disabled)) {
                setDisabledGroups([...disabledGroups, groupName]);
                return;
            }

            if (updatedGroupsData[groupIndex].items.some(({ disabled }) => !disabled)) {
                setDisabledGroups(disabledGroups.filter((item) => item !== groupName));
            }
        };

    useEffect(() => {
        setGroupsData(data.groups[tabIndex].data);
    }, [data, tabIndex]);

    return (
        <Root>
            <Header>
                <HeaderContent>
                    <HeaderTitle>{header}</HeaderTitle>
                    <HeaderSubtitle>{subheader}</HeaderSubtitle>
                </HeaderContent>
                <IconButton disabled>
                    <IconSearch size="xs" color="inherit" />
                </IconButton>
            </Header>
            {tabs && (
                <List>
                    <ListSectionTitle>{tabs.name}</ListSectionTitle>
                    {tabs.values.map((value, index) => (
                        <ListItem
                            selected={value === selectedTab}
                            onClick={() => onTabValueSelect(value)}
                            key={`${value}_${index}`}
                        >
                            <ListItemText>{value}</ListItemText>
                        </ListItem>
                    ))}
                </List>
            )}
            <List
                style={{
                    minHeight: 0,
                }}
            >
                <ListSectionTitle>{sectionTitle}</ListSectionTitle>
                <ListSectionGroups>
                    {groupsData.map(({ name: groupName, type, items }, groupIndex) => (
                        <ListSectionGroup key={`${groupName}_${selectedItem}_${selectedTab}`}>
                            <ListSectionGroupToggle onClick={() => onGroupToggle(groupName)}>
                                {openedGroups.includes(groupName) ? (
                                    <StyledIconChevronUp color="inherit" />
                                ) : (
                                    <StyledIconChevronDown color="inherit" />
                                )}
                            </ListSectionGroupToggle>
                            <ListItem
                                onClick={() => onGroupToggle(groupName)}
                                disabled={disabledGroups.includes(groupName)}
                            >
                                <ListItemWrapper>
                                    <ListItemText>{groupName}</ListItemText>
                                </ListItemWrapper>
                                <ListItemContentRight>
                                    {canAdd && (
                                        <IconButton onClick={onItemPlusButtonClick(groupName)}>
                                            <IconPlus size="xs" color="inherit" />
                                        </IconButton>
                                    )}
                                    {canDisable && (
                                        <IconButton onClick={onItemGroupDisable(groupName)}>
                                            {disabledGroups.includes(groupName) ? (
                                                <IconEyeClosedOutline size="xs" color="inherit" />
                                            ) : (
                                                <IconEyeOutline size="xs" color="inherit" />
                                            )}
                                        </IconButton>
                                    )}
                                </ListItemContentRight>
                            </ListItem>
                            {openedGroups.includes(groupName) && (
                                <ListItems>
                                    {items.map(
                                        ({ disabled, name: itemName, previewValues: values, data }, itemIndex) => (
                                            <ListItem
                                                key={`${itemName}_${selectedItem}_${selectedTab}`}
                                                selected={itemName === selectedItem}
                                                disabled={disabled}
                                                lineThrough={canDisable}
                                                onClick={onItemClick(
                                                    itemName,
                                                    disabled,
                                                    groupIndex,
                                                    itemIndex,
                                                    data,
                                                    groupName,
                                                    itemName,
                                                )}
                                            >
                                                <ListItemWrapper
                                                    // TODO: Недорогое и быстрое решение
                                                    canShowTooltip={canShowTooltip(itemName, disabled)}
                                                >
                                                    <ListItemText>{itemName}</ListItemText>
                                                    <ListItemPreviewWrapper>
                                                        {values.map((value, index) => (
                                                            <Fragment
                                                                key={`${itemName}_${selectedItem}_${value}_${index}`}
                                                            >
                                                                {value && type === 'color' && (
                                                                    <ListItemColorPreview
                                                                        style={{ background: value }}
                                                                    />
                                                                )}
                                                                {value && type === 'typography' && (
                                                                    <ListItemTypographyPreview>
                                                                        {value}
                                                                    </ListItemTypographyPreview>
                                                                )}
                                                                {value && type === 'shape' && (
                                                                    <ListItemShapePreview>{value}</ListItemShapePreview>
                                                                )}
                                                            </Fragment>
                                                        ))}
                                                    </ListItemPreviewWrapper>
                                                </ListItemWrapper>
                                                <ListItemContentRight>
                                                    {canDisable && (
                                                        <IconButton
                                                            onClick={onItemDisabledButtonClick(
                                                                groupName,
                                                                itemName,
                                                                data,
                                                                disabled,
                                                            )}
                                                        >
                                                            {disabled ? (
                                                                <IconEyeClosedOutline size="xs" color="inherit" />
                                                            ) : (
                                                                <IconEyeOutline size="xs" color="inherit" />
                                                            )}
                                                        </IconButton>
                                                    )}
                                                </ListItemContentRight>
                                                <Tooltip offset={[0.5, 0]} placement="top" text={itemName} />
                                            </ListItem>
                                        ),
                                    )}
                                    {groupNameWithItemCreating === groupName && (
                                        <TextField
                                            hasBackground
                                            stretched
                                            value={creatingItemName}
                                            autoFocus
                                            textBefore={lowerFirstLetter(groupName)}
                                            onChange={onItemAddChange}
                                            onCommit={(itemName) => onItemAddCommit(groupName, itemName, selectedTab)}
                                            onBlur={onItemAddCancel}
                                        />
                                    )}
                                </ListItems>
                            )}
                        </ListSectionGroup>
                    ))}
                </ListSectionGroups>
            </List>
        </Root>
    );
};
