import { pxToRem } from '../../../web-mapping/index.ts';
import type { PlatformTokens, PropConfig } from '../type.ts';
import { Prop } from './prop.ts';

export class DimensionProp extends Prop {
    protected readonly type = 'dimension';

    constructor(name: string, data: PropConfig, platformTokens?: PlatformTokens) {
        super(name, data, platformTokens);
    }

    public getWebTokenValue() {
        if (this.value === undefined) {
            return;
        }

        const value = pxToRem(Number(this.value));

        return {
            ...this.createWebToken(value),
        };
    }
}
