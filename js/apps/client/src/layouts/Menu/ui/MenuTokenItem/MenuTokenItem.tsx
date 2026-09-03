import { Fragment, MouseEvent } from 'react';
import { IconEyeClosedOutline, IconEyeOutline } from '@salutejs/plasma-icons';

import { IconButton, Tooltip } from '../../../../components';
import { TokenNode } from '../../../../types';
import {
    canShowTooltip,
    getTokenItems,
    getTokenPreviewValues,
    isTokenChanged,
    isTokenDisabled,
    MenuItemArgs,
} from '../../Menu.utils';

import {
    ListItem,
    ListItemColorPreview,
    ListItemContentRight,
    ListItemPreviewWrapper,
    ListItemText,
    ListItemWrapper,
} from './MenuTokenItem.styles';

interface MenuTokenItemProps {
    tokenNode: TokenNode;
    groupName: string;
    groupIndex: number;
    originalItemIndex: number;
    selectedItem?: string;
    canDisable: boolean;
    onItemClick: (args: MenuItemArgs) => (event: MouseEvent<HTMLDivElement>) => void;
    onItemDisabledButtonClick: (args: MenuItemArgs) => (event: MouseEvent<HTMLDivElement>) => void;
}

export const MenuTokenItem = (props: MenuTokenItemProps) => {
    const {
        tokenNode,
        groupName,
        groupIndex,
        originalItemIndex,
        selectedItem,
        canDisable,
        onItemClick,
        onItemDisabledButtonClick,
    } = props;

    const itemName = tokenNode.name;
    const items = getTokenItems(tokenNode);
    const previewValues = getTokenPreviewValues(tokenNode);
    const disabled = isTokenDisabled(tokenNode);

    const menuItem = {
        groupName,
        itemName,
        groupIndex,
        itemIndex: originalItemIndex,
        items,
        disabled,
    };

    return (
        <ListItem selected={itemName === selectedItem} disabled={disabled} onClick={onItemClick(menuItem)}>
            <ListItemWrapper
                // TODO: Недорогое и быстрое решение
                canShowTooltip={canShowTooltip(itemName, disabled)}
            >
                <ListItemPreviewWrapper changed={isTokenChanged(items)}>
                    {previewValues.map((value, index) => (
                        <Fragment key={`${itemName}_${selectedItem}_${value}_${index}`}>
                            {value && <ListItemColorPreview style={{ background: value }} />}
                        </Fragment>
                    ))}
                </ListItemPreviewWrapper>
                <ListItemText>{itemName}</ListItemText>
            </ListItemWrapper>
            <ListItemContentRight>
                {canDisable && (
                    <IconButton onClick={onItemDisabledButtonClick(menuItem)}>
                        {disabled ? (
                            <IconEyeClosedOutline size="xs" color="inherit" />
                        ) : (
                            <IconEyeOutline size="xs" color="inherit" />
                        )}
                    </IconButton>
                )}
            </ListItemContentRight>
            <Tooltip offset={[0.25, 0]} placement="top" text={itemName} />
        </ListItem>
    );
};
