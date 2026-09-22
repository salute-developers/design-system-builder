import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'view',
        description: 'Вид',
        styles: [
            { name: 'default', description: 'default' },
            { name: 'positive', description: 'positive' },
            { name: 'warning', description: 'warning' },
            { name: 'negative', description: 'negative' },
        ],
    },
    {
        name: 'size',
        description: 'Размер',
        styles: [
            { name: 'l', description: 'l' },
            { name: 'm', description: 'm' },
            { name: 's', description: 's' },
            { name: 'xs', description: 'xs' },
        ],
    },
    {
        name: 'labelPlacement',
        description: 'Расположение лейбла',
        styles: [
            { name: 'inner', description: 'inner' },
            { name: 'outer', description: 'outer' },
        ],
    },
    {
        name: 'chipView',
        description: 'Вид чипа',
        styles: [
            { name: 'default', description: 'default' },
            { name: 'secondary', description: 'secondary' },
            { name: 'accent', description: 'accent' },
        ],
    },
    {
        name: 'hintView',
        description: 'Вид подсказки',
        styles: [
            { name: 'default', description: 'default' },
        ],
    },
    {
        name: 'hintSize',
        description: 'Размер подсказки',
        styles: [
            { name: 'm', description: 'm' },
            { name: 's', description: 's' },
        ],
    },
];
