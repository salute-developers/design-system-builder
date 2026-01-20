import { GroupData } from '../../types';

// TODO: Недорогое и быстрое решение
export const MAX_CHARS_ITEM_NAME = 32;

export const getDefaultDisabledGroups = (groupsData: GroupData[]) => {
    return groupsData.reduce((acc, group) => {
        if (group.items.every(({ disabled }) => disabled)) {
            acc.push(group.name);
        }

        return acc;
    }, [] as string[]);
};
