import type { PropConfig, WebToken } from '../type';
import { Prop } from './prop';

export class FloatProp extends Prop {
    protected readonly type = 'float';

    constructor(name: string, data: PropConfig, webTokens?: WebToken[] | null) {
        super(name, data, webTokens);
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
