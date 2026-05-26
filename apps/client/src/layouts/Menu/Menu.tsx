import { MouseEvent, useEffect, useMemo, useRef, useState } from 'react';

import { Token } from '../../controllers';
import { GroupNode } from '../../types';
import { isDraftAddedToken } from '../../utils';

import {
    flattenTokenLeaves,
    getDefaultDisabledGroups,
    getTokenItems,
    isGroupChanged,
    isTokenChanged,
    isTokenDisabled,
    MenuItemArgs,
    TokenFilterValue,
} from './Menu.utils';
import { List, ListSectionGroups, Root } from './Menu.styles';
import { MenuFilterPopup, MenuGroupItem, MenuHeader } from './ui';

export interface MenuProps {
    header?: string;
    subheader?: string;
    data: GroupNode[];
    selectedItemIndexes?: [number, number];
    canDisable?: boolean;
    canAdd?: boolean;
    onItemSelect?: (groupIndex: number, itemIndex: number) => void;
    onItemAdd?: (groupName: string, itemName: string, items?: Token[]) => void;
    onItemDisable?: (items: Token[], disabled: boolean) => void;
}

export const Menu = (props: MenuProps) => {
    const {
        header,
        data,
        selectedItemIndexes,
        canAdd = true,
        canDisable = true,
        onItemSelect,
        onItemAdd,
        onItemDisable,
    } = props;

    const [groupIndex = 0, itemIndex = 0] = selectedItemIndexes || [];

    const [groupsData, setGroupsData] = useState<GroupNode[]>(data);
    const [openedGroups, setOpenedGroups] = useState<string[]>(() =>
        data[groupIndex]?.group ? [data[groupIndex].group] : [],
    );
    const [disabledGroups, setDisabledGroups] = useState<string[]>(() => getDefaultDisabledGroups(data));
    const [selectedItem, setSelectedItem] = useState<string | undefined>(() => data[groupIndex]?.data[itemIndex]?.name);
    const [groupNameWithItemCreating, setGroupNameWithItemCreating] = useState<string | undefined>(undefined);
    const [creatingItemName, setCreatingItemName] = useState<string>('NewItem');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [tokenFilter, setTokenFilter] = useState<TokenFilterValue>('all');
    const [filterAnchor, setFilterAnchor] = useState<HTMLElement | undefined>(undefined);
    const filterButtonRef = useRef<HTMLDivElement>(null);

    const isFilterOpen = Boolean(filterAnchor);

    const changedGroups = useMemo(
        () => new Set(groupsData.filter((group) => isGroupChanged(group.data)).map(({ group }) => group)),
        [groupsData],
    );

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const hasQuery = isSearchOpen && normalizedQuery.length > 0;
    const hasTokenFilter = tokenFilter !== 'all';
    const isFiltering = hasQuery || hasTokenFilter;

    const filteredGroups = useMemo(() => {
        if (!isFiltering) {
            return groupsData.map((group, originalIndex) => ({ group, originalIndex }));
        }

        const matchesTokenFilter = (tokenNode: GroupNode['data'][number]) => {
            if (tokenFilter === 'all') {
                return true;
            }

            if (tokenFilter === 'hidden') {
                return isTokenDisabled(tokenNode);
            }

            const items = getTokenItems(tokenNode);

            if (tokenFilter === 'added') {
                return items.some((item) => isDraftAddedToken(item.getName()));
            }

            if (tokenFilter === 'changed') {
                return isTokenChanged(items);
            }

            return true;
        };

        return groupsData
            .map((group, originalIndex) => ({
                originalIndex,
                group: {
                    ...group,
                    data: group.data.filter(
                        (tokenNode) =>
                            matchesTokenFilter(tokenNode) &&
                            (!hasQuery || tokenNode.name.toLowerCase().includes(normalizedQuery)),
                    ),
                },
            }))
            .filter(({ group }) => group.data.length > 0);
    }, [groupsData, isFiltering, hasQuery, normalizedQuery, tokenFilter]);

    const onSearchOpen = () => {
        setIsSearchOpen(true);
    };

    const onSearchReset = () => {
        setIsSearchOpen(false);
        setSearchQuery('');
    };

    const onSearchChange = (value: string) => {
        setSearchQuery(value);
    };

    const onFilterToggle = (event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();

        if (isFilterOpen) {
            setFilterAnchor(undefined);
            return;
        }

        setFilterAnchor(filterButtonRef.current ?? undefined);
    };

    const onFilterClose = () => {
        setFilterAnchor(undefined);
    };

    const onTokenFilterSelect = (value: TokenFilterValue) => {
        setTokenFilter(value);
        setFilterAnchor(undefined);
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

    const onItemAddCommit = (groupName: string, itemName: string) => {
        setGroupNameWithItemCreating(undefined);
        setCreatingItemName('');

        if (onItemAdd) {
            const groupNode = groupsData.find(({ group }) => group === groupNameWithItemCreating);
            const items = groupNode?.data[0] ? getTokenItems(groupNode.data[0]) : undefined;

            onItemAdd(groupName, itemName, items);
        }
    };

    const onItemAddCancel = () => {
        setGroupNameWithItemCreating(undefined);
        setCreatingItemName('');
    };

    const onItemGroupDisable = (name: string) => (event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();

        const targetGroup = groupsData.find((group) => group.group === name);
        if (!targetGroup) {
            return;
        }

        const isDisabled = disabledGroups.includes(name);

        targetGroup.data.forEach((tokenNode) => {
            flattenTokenLeaves(tokenNode).forEach((leaf) => {
                leaf.enabled = isDisabled;
            });
        });

        if (onItemDisable) {
            const items = targetGroup.data.flatMap((tokenNode) => getTokenItems(tokenNode));
            onItemDisable(items, isDisabled);
        }

        setGroupsData([...groupsData]);

        const newDisabledGroups = isDisabled
            ? disabledGroups.filter((item) => item !== name)
            : [...disabledGroups, name];

        setDisabledGroups(newDisabledGroups);
    };

    const onItemClick = (args: MenuItemArgs) => (event: MouseEvent<HTMLDivElement>) => {
        const { itemName, groupIndex, itemIndex, disabled } = args;

        if (disabled && !canDisable) {
            return;
        }

        if (disabled) {
            onItemDisabledButtonClick(args)(event);
            return;
        }

        setSelectedItem(itemName);

        if (onItemSelect) {
            onItemSelect(groupIndex, itemIndex);
        }
    };

    const onItemDisabledButtonClick = (args: MenuItemArgs) => (event: MouseEvent<HTMLDivElement>) => {
        const { groupName, itemName, items, disabled } = args;

        event.stopPropagation();

        const targetGroup = groupsData.find((group) => group.group === groupName);
        if (!targetGroup) {
            return;
        }

        const tokenNode = targetGroup.data.find((node) => node.name === itemName);
        if (!tokenNode) {
            return;
        }

        flattenTokenLeaves(tokenNode).forEach((leaf) => {
            leaf.enabled = disabled;
        });

        if (onItemDisable) {
            onItemDisable(items, disabled);
        }

        setGroupsData([...groupsData]);

        if (targetGroup.data.every((node) => isTokenDisabled(node))) {
            setDisabledGroups([...disabledGroups, groupName]);
            return;
        }

        if (targetGroup.data.some((node) => !isTokenDisabled(node))) {
            setDisabledGroups(disabledGroups.filter((item) => item !== groupName));
        }
    };

    const findOriginalItemIndex = (groupIndex: number, itemName: string) =>
        groupsData[groupIndex].data.findIndex((node) => node.name === itemName);

    useEffect(() => {
        setGroupsData(data);
    }, [data]);

    useEffect(() => {
        const initialGroup = data[groupIndex]?.group;
        setOpenedGroups(initialGroup ? [initialGroup] : []);
        setDisabledGroups(getDefaultDisabledGroups(data));
        setSelectedItem(data[groupIndex]?.data[itemIndex]?.name);
    }, []);

    useEffect(() => {
        const nextName = data[groupIndex]?.data[itemIndex]?.name;
        if (nextName) {
            setSelectedItem(nextName);
        }
    }, [data, groupIndex, itemIndex]);

    return (
        <Root>
            <MenuHeader
                header={header}
                isSearchOpen={isSearchOpen}
                searchQuery={searchQuery}
                filterButtonRef={filterButtonRef}
                onSearchOpen={onSearchOpen}
                onSearchReset={onSearchReset}
                onSearchChange={onSearchChange}
                onFilterToggle={onFilterToggle}
            />
            <List>
                <ListSectionGroups>
                    {filteredGroups.map(({ group, originalIndex }) => (
                        <MenuGroupItem
                            key={group.group}
                            group={group}
                            groupIndex={originalIndex}
                            isOpened={isFiltering || openedGroups.includes(group.group)}
                            isDisabled={disabledGroups.includes(group.group)}
                            isChanged={changedGroups.has(group.group)}
                            selectedItem={selectedItem}
                            canAdd={canAdd}
                            canDisable={canDisable}
                            isCreatingItem={groupNameWithItemCreating === group.group}
                            creatingItemName={creatingItemName}
                            findOriginalItemIndex={findOriginalItemIndex}
                            onGroupToggle={onGroupToggle}
                            onItemPlusButtonClick={onItemPlusButtonClick}
                            onItemGroupDisable={onItemGroupDisable}
                            onItemAddChange={onItemAddChange}
                            onItemAddCommit={onItemAddCommit}
                            onItemAddCancel={onItemAddCancel}
                            onItemClick={onItemClick}
                            onItemDisabledButtonClick={onItemDisabledButtonClick}
                        />
                    ))}
                </ListSectionGroups>
            </List>
            <MenuFilterPopup
                opened={isFilterOpen}
                anchor={filterAnchor}
                tokenFilter={tokenFilter}
                onClose={onFilterClose}
                onTokenFilterSelect={onTokenFilterSelect}
            />
        </Root>
    );
};
