import { Config, Token } from '../../controllers';
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

export const isGroupChanged = (items: { data: (Token | Config)[] }[]) => {
    return items.some(({ data }) => isTokenChanged(data));
};

export const isTokenChanged = (items: (Token | Config)[]) => {
    // TODO: Подумать, можно ли сделать по-другому
    if (!items.length || items[0] === undefined || items[0] instanceof Config) {
        return false;
    }

    const platforms = Object.keys(items[0].getPlatforms());

    for (const platform of platforms) {
        return (items as Token[]).some(
            (item) =>
                JSON.stringify(item.getDefaultValue(platform)) !== JSON.stringify(item.getValue(platform)) ||
                item.getDefaultDescription() !== item.getDescription(),
        );
    }

    return false;
};
