import { general as generalColors, type PlasmaSaturation } from '@salutejs/plasma-colors';
import { Grayscale, type TokensByType } from '@salutejs/plasma-tokens-utils';
import { Token } from '../../themeBuilder/tokens/token';

export type ComplexValue = string | Record<string, string>;

export type GeneralColor = keyof typeof generalColors;

export interface GroupedToken<T extends Token = Token> {
    data: T[] | GroupedToken<T>[];
    group?: string;
}

export interface TokenValue {
    value: ComplexValue;
    comment?: string;
    enabled?: boolean;
}

export interface ThemeData {
    themeName: string;
    accentColors: GeneralColor;
    lightSaturations: PlasmaSaturation;
    darkSaturations: PlasmaSaturation;
    lightGrayscale: Grayscale;
    darkGrayscale: Grayscale;
}

export interface InputDataCommon {
    value: string;
    status?: 'error';
    helpText?: string;
}

export type InputDataValue = Omit<InputDataCommon, 'value'> & { value: ComplexValue };

export type InputDataComment = Partial<InputDataCommon>;

export type InputDataEnabled = Omit<InputDataCommon, 'value'> & { value?: boolean };

export interface InputData {
    section: InputDataCommon;
    subsection: InputDataCommon;
    name: InputDataCommon;
    value: InputDataValue;
    comment?: InputDataComment;
    enabled?: InputDataEnabled;
}

export interface GetGreyTokenDataParams {
    saturation: PlasmaSaturation | 50;
    grayscale: Grayscale;
    opacity?: number | null;
}

export interface TokenContextHandlers {
    onOpenTokenForm: (data: InputData) => void;
    onTokenDelete: (data: InputData) => void;
    onTokenEnabled: (data: InputData) => void;
    onTokensSubsectionEnabled: (data: InputData) => void;
    onTokensSectionEnabled: (data: InputData) => void;
    // defaultData?: ThemeType;
}

export interface SavedTheme {
    themeData: any;
    date: string;
    branchName?: string;
}

export interface TokensCreator {
    comment: Record<keyof TokensByType, string>;
    darkValue: string;
    lightValue: string;
    enabledAll?: boolean;
    darkSubGroup?: string;
    lightSubGroup?: string;
}
