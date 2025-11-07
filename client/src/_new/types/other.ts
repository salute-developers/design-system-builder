import { PlasmaSaturation } from '@salutejs/plasma-colors';
import { general as generalColors } from '@salutejs/plasma-colors';

import { Token, Config } from '../../controllers';

export type GrayTone = 'gray' | 'warmGray' | 'coolGray';

export type ViewType = 'light' | 'dark';

export type SaturationType = 'fill' | 'stroke';

export type ComplexValue = string | Record<string, string>;

export type GeneralColor = keyof typeof generalColors;

export type ColorFormats = {
    hex: string;
    rgb: string;
    hsl: string;
};

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

export type MenuType = 'color' | 'shape' | 'typography' | 'components';

export interface Item {
    name: string;
    disabled: boolean;
    previewValues: string[];
    // TODO: подумать о разделении типов
    data: (Token | Config)[];
}

export interface GroupData {
    name: string;
    type: MenuType;
    items: Item[];
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

export type DataItems = Record<
    string,
    Record<
        string,
        Record<
            string,
            Record<
                string,
                {
                    enabled: boolean;
                    value: any;
                    item: Token | Config;
                }
            >
        >
    >
>;
