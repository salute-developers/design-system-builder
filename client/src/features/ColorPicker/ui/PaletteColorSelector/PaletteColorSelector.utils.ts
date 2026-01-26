import { general } from '@salutejs/plasma-colors';
import { prettifyColorName } from '../../../../utils';

export const accentColors = Object.entries(general).map(([name]) => ({
    label: prettifyColorName(name),
    value: name,
}));

export const saturationColors = Object.keys(general.amber).map((name) => ({
    label: name,
    value: name,
}));
