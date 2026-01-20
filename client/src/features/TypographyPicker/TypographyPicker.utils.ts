import { SelectButtonItem } from '../../components';

export const fontStyleList = [
    {
        label: 'Normal',
        value: 'normal',
    },
    {
        label: 'Italic',
        value: 'italic',
    },
];

export const fontWeightList = [
    {
        label: 'Thin',
        value: '100',
    },
    {
        label: 'Extra Light',
        value: '200',
    },
    {
        label: 'Light',
        value: '300',
    },
    {
        label: 'Regular',
        value: '400',
    },
    {
        label: 'Medium',
        value: '500',
    },
    {
        label: 'Semi Bold',
        value: '600',
    },
    {
        label: 'Bold',
        value: '700',
    },
    {
        label: 'Extra Bold',
        value: '800',
    },
    {
        label: 'Black',
        value: '900',
    },
];

export const getLabelByItem = (items: SelectButtonItem[], value: string) =>
    items.find((item) => item.value === value)?.label;
