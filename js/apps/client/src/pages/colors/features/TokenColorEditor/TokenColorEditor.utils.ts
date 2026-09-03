import { ColorToken, GradientToken } from '../../../../controllers';
import { SubgroupNode } from '../../../../types';
import { getColorAndOpacity } from '../../../../utils';

export const modeList = [
    {
        label: 'Dark',
        value: 'dark',
    },
    {
        label: 'Light',
        value: 'light',
    },
];

export const typeList = [
    {
        label: 'Сплошной',
        value: 'color',
        disabled: true,
    },
    {
        label: 'Градиент',
        value: 'gradient',
        disabled: true,
    },
];

export const getDisplayColor = (value: string | string[]) => {
    const [color, opacity] = getColorAndOpacity(value);

    if (color.startsWith('general')) {
        return [color.replace(/general\.|\./g, ''), opacity] as const;
    }

    if (color.startsWith('radial') || color.startsWith('linear')) {
        return ['gradient', 1] as const;
    }

    return [color, opacity] as const;
};

const getDefaultLeaf = (subgroupNodes: SubgroupNode[], mode: string) =>
    subgroupNodes.find((node) => node.subgroup === 'default')?.data.find((modeNode) => modeNode.mode === mode)?.data
        .item;

const linkedTargetsFromLight = [
    { subgroup: 'inverse', mode: 'dark' },
    { subgroup: 'onLight', mode: 'dark' },
    { subgroup: 'onLight', mode: 'light' },
];

const linkedTargetsFromDark = [
    { subgroup: 'inverse', mode: 'light' },
    { subgroup: 'onDark', mode: 'dark' },
    { subgroup: 'onDark', mode: 'light' },
];

const getDefaultMappingMode = (subgroup: string, mode: string): string | null => {
    if (subgroup === 'inverse') {
        return mode === 'dark' ? 'light' : mode === 'light' ? 'dark' : null;
    }

    if (subgroup === 'onDark') {
        return 'dark';
    }

    if (subgroup === 'onLight') {
        return 'light';
    }

    return null;
};

export const getExpectedValue = (
    subgroupNodes: SubgroupNode[],
    subgroup: string,
    mode: string,
): { value: string; opacity: number } | null => {
    const defaultMode = getDefaultMappingMode(subgroup, mode);
    if (!defaultMode) {
        return null;
    }

    const sourceToken = getDefaultLeaf(subgroupNodes, defaultMode);
    if (!sourceToken) {
        return null;
    }

    if (sourceToken instanceof GradientToken) {
        return { value: sourceToken.getValue('web').join(', '), opacity: 1 };
    }

    const [color, opacity] = getColorAndOpacity(sourceToken.getValue('web') as string);

    return { value: color, opacity };
};

const isLeafLinked = (
    subgroupNodes: SubgroupNode[],
    subgroup: string,
    mode: string,
    item: ColorToken | GradientToken,
) => {
    const expected = getExpectedValue(subgroupNodes, subgroup, mode);
    if (!expected) {
        return true;
    }
    if (item instanceof GradientToken) {
        return item.getValue('web').join(', ') === expected.value;
    }
    const [color, opacity] = getColorAndOpacity(item.getValue('web') as string);
    return color === expected.value && opacity === expected.opacity;
};

export const isSubgroupLinked = (subgroupNodes: SubgroupNode[]) => (node: SubgroupNode) =>
    node.data.every(({ mode, data: { item } }) => isLeafLinked(subgroupNodes, node.subgroup, mode, item));

export const isContextSubgroup = (subgroup: string) => ['inverse', 'onDark', 'onLight'].includes(subgroup);

const findLinkedToken = (subgroupNodes: SubgroupNode[], subgroup: string, mode: string) =>
    subgroupNodes.find((node) => node.subgroup === subgroup)?.data.find((modeNode) => modeNode.mode === mode)?.data
        .item;

export const captureLinkedSnapshot = (subgroupNodes: SubgroupNode[]) => {
    const snapshot = new Map<string, boolean>();

    subgroupNodes
        .filter((node) => isContextSubgroup(node.subgroup))
        .forEach((node) => snapshot.set(node.subgroup, isSubgroupLinked(subgroupNodes)(node)));

    return snapshot;
};

const getLinkedTargets = (targetMode: string) =>
    targetMode === 'dark' ? linkedTargetsFromDark : targetMode === 'light' ? linkedTargetsFromLight : [];

export const propagateFromDefault = (
    subgroupNodes: SubgroupNode[],
    targetTags: string[],
    wasLinkedBefore: Map<string, boolean>,
    apply: (linkedToken: ColorToken | GradientToken) => void,
) => {
    const [targetMode, , targetSubgroup] = targetTags;

    if (targetSubgroup !== 'default') {
        return;
    }

    getLinkedTargets(targetMode).forEach(({ subgroup, mode }) => {
        if (!wasLinkedBefore.get(subgroup)) {
            return;
        }

        const linkedToken = findLinkedToken(subgroupNodes, subgroup, mode);

        if (!linkedToken) {
            return;
        }

        apply(linkedToken);
    });
};
