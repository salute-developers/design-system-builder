import { Token } from '../../controllers';
import { GroupNode, TokenNode } from '../../types';
import { isDraftAddedToken } from '../../utils';

export interface MenuItemArgs {
    groupName: string;
    itemName: string;
    groupIndex: number;
    itemIndex: number;
    items: Token[];
    disabled: boolean;
}

export const tokenFilterList = [
    { value: 'all', label: 'Все', disabled: false },
    { value: 'added', label: 'Добавленные', disabled: false },
    { value: 'changed', label: 'Изменённые', disabled: false },
    { value: 'hidden', label: 'Скрытые', disabled: false },
    { value: 'deleted', label: 'Удалённые', disabled: true },
] as const;

export type TokenFilterValue = (typeof tokenFilterList)[number]['value'];

export const validateFilterList = [
    { value: 'all', label: 'Все', disabled: false },
    { value: 'errors', label: 'Ошибки', disabled: true },
    { value: 'warnings', label: 'Предупреждения', disabled: true },
] as const;

export type ValidateFilterValue = (typeof validateFilterList)[number]['value'];

export const flattenTokenLeaves = (tokenNode: TokenNode) =>
    tokenNode.data.flatMap((subgroupNode) => subgroupNode.data.map((modeNode) => modeNode.data));

export const isTokenDisabled = (tokenNode: TokenNode) => flattenTokenLeaves(tokenNode).every((leaf) => !leaf.enabled);

export const getTokenItems = (tokenNode: TokenNode) =>
    flattenTokenLeaves(tokenNode).map((leaf) => leaf.item) as Token[];

export const getTokenPreviewValues = (tokenNode: TokenNode) =>
    flattenTokenLeaves(tokenNode)
        .filter((leaf) => leaf.item.getTags()?.[2] === 'default')
        .map((leaf) => leaf.value);

export const getDefaultDisabledGroups = (groups: GroupNode[]) => {
    return groups.reduce((acc, group) => {
        if (group.data.every((tokenNode) => isTokenDisabled(tokenNode))) {
            acc.push(group.group);
        }

        return acc;
    }, [] as string[]);
};

// TODO: Быстрое решение, переделать на что-то более универсальное
export const canShowTooltip = (name: string, isDisabled: boolean) => {
    const maxCharsItemName = 22;
    const maxCharsItemDisabledName = 27;

    const maxChars = isDisabled ? maxCharsItemDisabledName : maxCharsItemName;
    return name.length >= maxChars;
};

export const isGroupChanged = (tokenNodes: TokenNode[]) => {
    return tokenNodes.some((tokenNode) => isTokenChanged(getTokenItems(tokenNode)));
};

export const isTokenChanged = (items: Token[]) => {
    if (!items.length || items[0] === undefined) {
        return false;
    }

    if (items.some((item) => isDraftAddedToken(item.getName()))) {
        return true;
    }

    const platforms = Object.keys(items[0].getPlatforms());

    for (const platform of platforms) {
        return items.some(
            (item) =>
                JSON.stringify(item.getDefaultValue(platform)) !== JSON.stringify(item.getValue(platform)) ||
                item.getDefaultDescription() !== item.getDescription(),
        );
    }

    return false;
};
