import type { PlatformTokens, PropConfig } from '../type';
import { Prop } from './prop';

export class ShapeProp extends Prop {
    protected readonly type = 'shape';

    constructor(name: string, data: PropConfig, platformTokens?: PlatformTokens) {
        super(name, data, platformTokens);
    }
}
