import { PlatformType, Platforms } from '../types';

export type PlatformClasses<U extends Platforms = Platforms> = {
    [key in PlatformType]: PlatformToken<U[key]>;
};

export abstract class PlatformToken<T extends Platforms[PlatformType] = Platforms[PlatformType]> {
    protected value: T[string];
    protected default: T[string];

    constructor(value: T[string]) {
        this.value = value;
        this.default = value;
    }

    public getValue(): T[string] {
        return this.value;
    }

    abstract setValue(value: T[string]): void;

    public getDefault(): T[string] {
        return this.default;
    }
}
