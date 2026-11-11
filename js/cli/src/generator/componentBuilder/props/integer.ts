import type { PlatformTokens, PropConfig } from '../type.ts';
import { Prop } from './prop.ts';

export class IntegerProp extends Prop {
    protected readonly type = 'integer';

    constructor(name: string, data: PropConfig, platformTokens?: PlatformTokens) {
        super(name, data, platformTokens);
    }

    public getWebTokenValue() {
        if (this.value === undefined) {
            return;
        }

        return {
            ...this.createWebToken(this.value),
        };
    }
}
