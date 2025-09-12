import { PlasmaSaturation } from '@salutejs/plasma-colors';

import { GeneralColor } from './general';

export type GrayTone = 'gray' | 'warmGray' | 'coolGray';

export type ViewType = 'light' | 'dark';

export type SaturationType = 'fill' | 'stroke';

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
