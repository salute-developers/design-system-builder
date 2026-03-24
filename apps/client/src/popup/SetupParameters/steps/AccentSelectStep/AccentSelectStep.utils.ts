import { general } from '@salutejs/plasma-colors';

import { prettifyColorName } from '../../../../utils';

export const accentColors = Object.entries(general)
    .slice(0, -3)
    .map(([name, item]) => ({
        label: prettifyColorName(name),
        value: name,
        color: item[600],
    }));
