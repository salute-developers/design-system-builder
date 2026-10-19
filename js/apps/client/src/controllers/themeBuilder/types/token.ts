export interface Variations<
    T1 = any,
    T2 = any,
    T3 = any,
    T4 = any,
    T5 = any,
    T6 = any,
    T7 = any,
> {
    color: T1;
    gradient: T2;
    shape: T4;
    shadow: T3;
    spacing: T5;
    typography: T6;
    fontFamily: T7;
}

export interface Platforms<
    T1 extends Record<string, any> = Record<string, any>,
    T2 extends Record<string, any> = Record<string, any>,
    T3 extends Record<string, any> = Record<string, any>,
> {
    web: T1;
    ios: T2;
    android: T3;
}

export type VariationType = keyof Variations;

export type PlatformType = keyof Platforms;

export interface TokenType {
    type: VariationType;
    name: string;
    tags: Array<string>;
    displayName: string;
    description?: string;
    enabled: boolean;
}
