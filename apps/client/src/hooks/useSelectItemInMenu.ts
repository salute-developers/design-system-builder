import { useMemo, useState } from 'react';

export const useSelectItemInMenu = (
    [defaultTabIndex, defaultGroupIndex, defaultItemIndex]: [number, number, number] = [0, 0, 0],
) => {
    const [tabIndex, setTabIndex] = useState(defaultTabIndex);
    const [groupIndex, setGroupIndex] = useState(defaultGroupIndex);
    const [itemIndex, setItemIndex] = useState(defaultItemIndex);

    const selectedItemIndexes: [number, number, number] = useMemo(
        () => [tabIndex, groupIndex, itemIndex],
        [tabIndex, groupIndex, itemIndex],
    );

    const onItemSelect = (groupIndex: number, itemIndex: number) => {
        setGroupIndex(groupIndex);
        setItemIndex(itemIndex);
    };

    const onTabSelect = (index: number) => {
        setTabIndex(index);
    };

    return [selectedItemIndexes, onItemSelect, onTabSelect] as const;
};
