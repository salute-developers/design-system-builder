import type { PlatformTokens, PropConfig } from '../type';
import { Prop } from './prop';

export class ShadowProp extends Prop {
    protected readonly type = 'shadow';

    constructor(name: string, data: PropConfig, platformTokens?: PlatformTokens) {
        super(name, data, platformTokens);
    }
}
