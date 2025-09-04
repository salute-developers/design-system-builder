import { PlasmaSaturation } from '@salutejs/plasma-colors';

import { GeneralColor } from './general';

export type GrayTone = 'gray' | 'warmGray' | 'coolGray';

export interface Parameters {
    projectName: string;
    packagesName: string;
    grayTone: GrayTone;
    accentColor: GeneralColor;
    lightStrokeSaturation: PlasmaSaturation;
    lightFillSaturation: PlasmaSaturation;
    darkStrokeSaturation: PlasmaSaturation;
    darkFillSaturation: PlasmaSaturation;
}

export const grayTones = [
    { value: 'gray', label: 'Без примесей' },
    { value: 'warmGray', label: 'Тёплый' },
    { value: 'coolGray', label: 'Холодный' },
];
