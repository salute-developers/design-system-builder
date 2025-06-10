import { general as generalColors, type PlasmaSaturation } from '@salutejs/plasma-colors';

import type { GeneralColor } from '../types';
import { PreviewColor } from '../pages/theme/PreviewColor';

export const getSaturations = (accentColors: GeneralColor = 'red') =>
    Object.keys(generalColors.amber).map((name: any) => ({
        value: name,
        label: name,
        contentLeft: (
            <PreviewColor
                background={generalColors[accentColors][name as PlasmaSaturation]}
                borderRadius="0.5rem"
                size="2rem"
            />
        ),
    }));

export const getAccentColors = () =>
    Object.entries(generalColors).map(([name, item]) => ({
        value: name as GeneralColor,
        label: name,
        contentLeft: <PreviewColor background={item['500']} borderRadius="0.5rem" size="2rem" />,
    }));
