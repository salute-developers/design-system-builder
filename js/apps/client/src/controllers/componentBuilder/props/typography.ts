import type { PlatformTokens, PropConfig } from '../type';
import { Prop } from './prop';

export class TypographyProp extends Prop {
    protected readonly type = 'typography';

    constructor(name: string, data: PropConfig, platformTokens?: PlatformTokens) {
        super(name, data, platformTokens);
    }
}
