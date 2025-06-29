import type { PlatformTokens, PropConfig } from '../type';
import { Prop } from './prop';

export class FloatProp extends Prop {
    protected readonly type = 'float';

    constructor(name: string, data: PropConfig, platformTokens?: PlatformTokens) {
        super(name, data, platformTokens);
    }

    public getWebTokenValue(componentName?: string) {
        if (this.value === undefined) {
            return;
        }

        return {
            ...this.createWebToken(this.value, componentName),
        };
    }
}
