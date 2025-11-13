import { Fragment, MouseEvent, useEffect, useState } from 'react';
import styled, { css, CSSObject } from 'styled-components';
import {
    IconChevronDown,
    IconChevronUp,
    IconEye,
    IconEyeClosedFill,
    IconPlus,
    IconSearch,
} from '@salutejs/plasma-icons';
import { lowerFirstLetter } from '@salutejs/plasma-tokens-utils';
import {
    bodyXXS,
    outlineTransparentPrimary,
    surfaceTransparentPrimary,
    textPrimary,
    textSecondary,
    textTertiary,
} from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../utils';
import { Data, GroupData } from '../types';
import { Config, Token } from '../controllers';
import { IconButton, Tooltip, TextField } from '../components';

const Root = styled.div`
    height: 100%;

    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    &:hover > div:nth-child(2) > div > div > div:nth-child(1),
    &:hover > div:nth-child(3) > div > div > div:nth-child(1) {
        display: block;
    }
`;

const Header = styled.div`
    padding: 0 0.5rem;
    box-sizing: border-box;

    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
`;

const HeaderContent = styled.div``;

const HeaderTitle = styled.div`
    margin-top: 0.25rem;
    overflow: hidden;
    text-overflow: ellipsis;

    color: ${textPrimary};
    ${h6 as CSSObject};
    font-weight: 600;
`;

const HeaderSubtitle = styled.div`
    margin-top: 0.25rem;
    overflow: hidden;
    text-overflow: ellipsis;

    color: ${textTertiary};
    ${h6 as CSSObject};
`;

const List = styled.div`
    display: flex;
    flex-direction: column;
`;

const ListSectionTitle = styled.div`
    padding: 0 0.5rem;
    box-sizing: border-box;
    min-height: 2rem;

    color: ${textTertiary};

    display: flex;
    flex-direction: row;
    align-items: center;

    ${h6 as CSSObject};
`;

const ListSectionGroups = styled.div`
    display: flex;
    flex-direction: column;

    padding-left: 0.75rem;
    margin-left: -0.75rem;

    overflow-y: scroll;
    overflow-x: visible;
`;

const ListSectionGroup = styled.div`
    position: relative;

    display: flex;
    flex-direction: column;
`;

const ListSectionGroupToggle = styled.div`
    display: none;

    position: absolute;
    left: 0;
    transform: translateX(-0.5rem);
    top: 0.25rem;
    cursor: pointer;
`;

const ListItems = styled.div`
    max-height: 32rem;
    overflow-y: scroll;
`;

const ListItem = styled.div<{ selected?: boolean; disabled?: boolean; lineThrough?: boolean }>`
    position: relative;
    cursor: pointer;

    margin: 0.25rem 0;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;

    color: ${textSecondary};

    ${({ selected, disabled }) =>
        selected &&
        !disabled &&
        css`
            cursor: default;
            color: ${textPrimary};
            background: ${surfaceTransparentPrimary};
        `}

    ${({ disabled, lineThrough }) =>
        disabled &&
        css`
            text-decoration: ${lineThrough ? 'line-through' : 'none'};
            cursor: not-allowed;
            color: ${textTertiary};

            & > div:nth-child(2) {
                display: flex;
            }

            & > div:nth-child(2) div {
                color: inherit;

                &:hover {
                    color: ${textPrimary};
                }
            }
        `}

    ${({ disabled }) =>
        !disabled &&
        css`
            &:hover {
                color: ${textPrimary};
            }

            &:hover > div > div {
                display: flex;
            }
        `}

    &:hover > div:nth-child(2) {
        display: flex;
    }

    display: flex;
    gap: 0.75rem;
    align-items: center;
    align-self: stretch;
    justify-content: space-between;
`;

const ListItemWrapper = styled.div<{ canShowTooltip?: boolean }>`
    display: flex;
    gap: 0.25rem;
    align-items: center;

    overflow: hidden;

    ${({ canShowTooltip }) =>
        canShowTooltip &&
        css`
            &:hover ~ div:nth-child(3) {
                display: flex;
            }
        `}
`;

const ListItemText = styled.span`
    user-select: none;

    color: inherit;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    ${h6 as CSSObject};
`;

const ListItemPreviewWrapper = styled.div`
    display: none;
    align-items: center;
    gap: 0.375rem;
`;

const ListItemColorPreview = styled.div<{ color: string }>`
    background: ${({ color }) => color};
    box-shadow: 0 0 0 0.0625rem ${outlineTransparentPrimary} inset;

    min-height: 0.75rem;
    min-width: 0.75rem;
    border-radius: 50%;
`;

const ListItemTypographyPreview = styled.div`
    color: ${textTertiary};

    ${bodyXXS as CSSObject};
`;

const ListItemShapePreview = styled.div`
    color: ${textTertiary};

    ${bodyXXS as CSSObject};

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const ListItemContentRight = styled.div`
    display: none;

    align-items: center;
    align-self: stretch;
    gap: 0.5rem;
`;

const StyledIconChevronDown = styled(IconChevronDown)`
    --icon-size: 0.5rem !important;
`;

const StyledIconChevronUp = styled(IconChevronUp)`
    --icon-size: 0.5rem !important;
`;

// TODO: Недорогое и быстрое решение
const MAX_CHARS_ITEM_NAME = 32;

const getDefaultDisabledGroups = (groupsData: GroupData[]) => {
    return groupsData.reduce((acc, group) => {
        if (group.items.every(({ disabled }) => disabled)) {
            acc.push(group.name);
        }

        return acc;
    }, [] as string[]);
};

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

    const onItemClick = (name: string, disabled: boolean, groupIndex: number, itemIndex: number) => {
        if (disabled) {
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
                                                <IconEyeClosedFill size="xs" color="inherit" />
                                            ) : (
                                                <IconEye size="xs" color="inherit" />
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
                                                onClick={() => onItemClick(itemName, disabled, groupIndex, itemIndex)}
                                            >
                                                <ListItemWrapper
                                                    // TODO: Недорогое и быстрое решение
                                                    canShowTooltip={Boolean(itemName.length > MAX_CHARS_ITEM_NAME)}
                                                >
                                                    <ListItemText>{itemName}</ListItemText>
                                                    <ListItemPreviewWrapper>
                                                        {values.map((value, index) => (
                                                            <Fragment
                                                                key={`${itemName}_${selectedItem}_${value}_${index}`}
                                                            >
                                                                {value && type === 'color' && (
                                                                    <ListItemColorPreview color={value} />
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
                                                                <IconEyeClosedFill size="xs" color="inherit" />
                                                            ) : (
                                                                <IconEye size="xs" color="inherit" />
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
