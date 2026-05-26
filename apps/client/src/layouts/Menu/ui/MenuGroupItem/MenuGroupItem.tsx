import { MouseEvent } from 'react';
import { IconEyeClosedOutline, IconEyeOutline, IconPlus } from '@salutejs/plasma-icons';
import { upperFirstLetter } from '@salutejs/plasma-tokens-utils';

import { IconButton, TextField } from '../../../../components';
import { GroupNode } from '../../../../types';
import { MenuItemArgs } from '../../Menu.utils';
import { ListItem, ListItemContentRight, ListItemWrapper } from '../MenuTokenItem/MenuTokenItem.styles';
import { MenuTokenItem } from '../MenuTokenItem';

import {
    ListGroupTitle,
    ListItemChangedIndicator,
    ListItems,
    ListSectionGroup,
    ListSectionGroupToggle,
    StyledIconChevronDown,
    StyledIconChevronRight,
} from './MenuGroupItem.styles';

interface MenuGroupItemProps {
    group: GroupNode;
    groupIndex: number;
    isOpened: boolean;
    isDisabled: boolean;
    isChanged: boolean;
    selectedItem?: string;
    canAdd: boolean;
    canDisable: boolean;
    isCreatingItem: boolean;
    creatingItemName: string;
    onGroupToggle: (name: string) => void;
    onItemPlusButtonClick: (groupName: string) => (event: MouseEvent<HTMLDivElement>) => void;
    onItemGroupDisable: (name: string) => (event: MouseEvent<HTMLDivElement>) => void;
    onItemAddChange: (value: string) => void;
    onItemAddCommit: (groupName: string, itemName: string) => void;
    onItemAddCancel: () => void;
    onItemClick: (args: MenuItemArgs) => (event: MouseEvent<HTMLDivElement>) => void;
    onItemDisabledButtonClick: (args: MenuItemArgs) => (event: MouseEvent<HTMLDivElement>) => void;
    findOriginalItemIndex: (groupIndex: number, itemName: string) => number;
}

export const MenuGroupItem = (props: MenuGroupItemProps) => {
    const {
        group,
        groupIndex,
        isOpened,
        isDisabled,
        isChanged,
        selectedItem,
        canAdd,
        canDisable,
        isCreatingItem,
        creatingItemName,
        onGroupToggle,
        onItemPlusButtonClick,
        onItemGroupDisable,
        onItemAddChange,
        onItemAddCommit,
        onItemAddCancel,
        onItemClick,
        onItemDisabledButtonClick,
        findOriginalItemIndex,
    } = props;

    const { group: groupName, data: tokenNodes } = group;

    return (
        <ListSectionGroup>
            <ListSectionGroupToggle onClick={() => onGroupToggle(groupName)}>
                {isOpened ? (
                    <StyledIconChevronDown color="inherit" />
                ) : (
                    <StyledIconChevronRight color="inherit" />
                )}
            </ListSectionGroupToggle>
            <ListItem onClick={() => onGroupToggle(groupName)} disabled={isDisabled}>
                <ListItemWrapper>
                    <ListGroupTitle>{upperFirstLetter(groupName)}</ListGroupTitle>
                    {!isOpened && isChanged && <ListItemChangedIndicator />}
                </ListItemWrapper>
                <ListItemContentRight>
                    {canAdd && (
                        <IconButton onClick={onItemPlusButtonClick(groupName)}>
                            <IconPlus size="xs" color="inherit" />
                        </IconButton>
                    )}
                    {canDisable && (
                        <IconButton onClick={onItemGroupDisable(groupName)}>
                            {isDisabled ? (
                                <IconEyeClosedOutline size="xs" color="inherit" />
                            ) : (
                                <IconEyeOutline size="xs" color="inherit" />
                            )}
                        </IconButton>
                    )}
                </ListItemContentRight>
            </ListItem>
            {isOpened && (
                <ListItems>
                    {tokenNodes.map((tokenNode) => (
                        <MenuTokenItem
                            key={tokenNode.name}
                            tokenNode={tokenNode}
                            groupName={groupName}
                            groupIndex={groupIndex}
                            originalItemIndex={findOriginalItemIndex(groupIndex, tokenNode.name)}
                            selectedItem={selectedItem}
                            canDisable={canDisable}
                            onItemClick={onItemClick}
                            onItemDisabledButtonClick={onItemDisabledButtonClick}
                        />
                    ))}
                    {isCreatingItem && (
                        <TextField
                            hasBackground
                            stretched
                            value={creatingItemName}
                            autoFocus
                            onChange={onItemAddChange}
                            onCommit={(itemName) => onItemAddCommit(groupName, itemName)}
                            onBlur={onItemAddCancel}
                        />
                    )}
                </ListItems>
            )}
        </ListSectionGroup>
    );
};
