import { useEffect, useMemo, useState } from 'react';
import { ColorToken, GradientToken } from '../controllers';

import { GroupNode } from '../types';

export const getAnchor = (node: GroupNode['data'][number]) => node.data[0]?.data[0]?.data.item;

const locateNodeByToken = (data: GroupNode[], token: ColorToken | GradientToken) => {
    for (let groupIndex = 0; groupIndex < data.length; groupIndex += 1) {
        const group = data[groupIndex];
        const itemIndex = group.data.findIndex((node) => getAnchor(node) === token);

        if (itemIndex !== -1) {
            return { node: group.data[itemIndex], groupIndex, itemIndex };
        }
    }

    return undefined;
};

interface UseTokenNodeSelectionProps {
    data: GroupNode[] | undefined;
    groupIndex: number;
    itemIndex: number;
    onItemSelect: (groupIndex: number, itemIndex: number) => void;
}

export const useTokenNodeSelection = ({ data, groupIndex, itemIndex, onItemSelect }: UseTokenNodeSelectionProps) => {
    const [selectedToken, setSelectedToken] = useState<ColorToken | GradientToken | undefined>(undefined);

    const located = useMemo(
        () => (data && selectedToken ? locateNodeByToken(data, selectedToken) : undefined),
        [data, selectedToken],
    );

    const tokenNode = located?.node ?? data?.[groupIndex]?.data[itemIndex] ?? data?.[0]?.data[0];

    useEffect(() => {
        if (!tokenNode) {
            return;
        }

        const nextToken = getAnchor(tokenNode);

        if (nextToken && nextToken !== selectedToken) {
            setSelectedToken(nextToken);
        }

        const hasIndexedNode = Boolean(data?.[groupIndex]?.data[itemIndex]);
        const nextGroupIndex = located?.groupIndex ?? (hasIndexedNode ? groupIndex : 0);
        const nextItemIndex = located?.itemIndex ?? (hasIndexedNode ? itemIndex : 0);

        if (nextGroupIndex !== groupIndex || nextItemIndex !== itemIndex) {
            onItemSelect(nextGroupIndex, nextItemIndex);
        }
    }, [tokenNode]);

    return { tokenNode, selectToken: setSelectedToken };
};
