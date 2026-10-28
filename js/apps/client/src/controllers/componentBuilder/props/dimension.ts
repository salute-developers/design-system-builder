import type { PlatformTokens, PropConfig } from '../type';
import { Prop } from './prop';

export class DimensionProp extends Prop {
    protected readonly type = 'dimension';

    constructor(name: string, data: PropConfig, platformTokens?: PlatformTokens) {
        super(name, data, platformTokens);
    }
}
