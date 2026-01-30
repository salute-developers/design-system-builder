import { GroupData } from '../../types';

export const getDefaultDisabledGroups = (groupsData: GroupData[]) => {
    return groupsData.reduce((acc, group) => {
        if (group.items.every(({ disabled }) => disabled)) {
            acc.push(group.name);
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
