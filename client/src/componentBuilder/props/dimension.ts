import { DEFAULT_FONT_SIZE, type PropConfig, type WebToken } from '../type';
import { Prop } from './prop';

export class DimensionProp extends Prop {
    protected readonly type = 'dimension';

    constructor(name: string, data: PropConfig, webTokens?: WebToken[] | null) {
        super(name, data, webTokens);
    }

    public getWebTokenValue() {
        if (this.value === undefined) {
            return;
        }

        const value = `${Number(this.value) / DEFAULT_FONT_SIZE}rem`;

        return {
            ...this.createWebToken(value),
        };
    }
}
