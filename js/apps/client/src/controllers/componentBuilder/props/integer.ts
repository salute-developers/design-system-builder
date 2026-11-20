import type { PlatformTokens, PropConfig } from '../type';
import { Prop } from './prop';

export class IntegerProp extends Prop {
    protected readonly type = 'integer';

    constructor(name: string, data: PropConfig, platformTokens?: PlatformTokens) {
        super(name, data, platformTokens);
    }
}
