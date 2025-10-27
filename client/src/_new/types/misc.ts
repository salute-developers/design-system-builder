import { PlasmaSaturation } from '@salutejs/plasma-colors';

import { GeneralColor } from './general';
import { Token as TokenBuilder } from '../../themeBuilder/tokens/token';

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

export type TokenType = 'color' | 'shape' | 'typography';

export interface Token {
    name: string;
    disabled: boolean;
    previewValues: string[];
    data: TokenBuilder[];
}

export interface GroupData {
    name: string;
    type: TokenType;
    tokens: Token[];
}

export interface Group {
    value?: string;
    data: GroupData[];
}

export interface Tab {
    name: string;
    values: string[];
}

export interface Data {
    tabs?: Tab;
    groups: Group[];
}
