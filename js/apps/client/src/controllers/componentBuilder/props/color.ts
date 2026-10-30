import type { PlatformTokens, PropConfig } from '../type';
import { Prop } from './prop';

export class ColorProp extends Prop {
    protected readonly type = 'color';

    constructor(name: string, data: PropConfig, platformTokens?: PlatformTokens) {
        super(name, data, platformTokens);
    }
}
