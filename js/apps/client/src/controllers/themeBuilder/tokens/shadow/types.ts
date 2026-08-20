/* WEB */

export interface WebShadowToken {
    [k: string]: Array<string>;
}

/* IOS */

export interface IOSShadowToken {
    [k: string]: Array<{
        color: string;
        offsetX: number;
        offsetY: number;
        spreadRadius: number;
        blurRadius: number;
        fallbackElevation?: number;
    }>;
}

/* ANDROID */

export interface AndroidShadowToken {
    [k: string]: Array<{
        color: string;
        offsetX: number;
        offsetY: number;
        spreadRadius: number;
        blurRadius: number;
        fallbackElevation?: number;
    }>;
}
