/* WEB */

export interface WebSpacingToken {
    [k: string]: string;
}

/* IOS */

export interface IOSSpacingToken {
    [k: string]: {
        value: number;
    };
}

/* ANDROID */

export interface AndroidSpacingToken {
    [k: string]: {
        value: number;
    };
}
