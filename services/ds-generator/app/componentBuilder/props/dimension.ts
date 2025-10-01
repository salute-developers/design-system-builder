import { DEFAULT_FONT_SIZE, type PlatformTokens, type PropConfig } from '../type';
import { Prop } from './prop';

export class DimensionProp extends Prop {
    protected readonly type = 'dimension';

    constructor(name: string, data: PropConfig, platformTokens?: PlatformTokens) {
        super(name, data, platformTokens);
    }

    public getWebTokenValue(componentName?: string) {
        if (this.value === undefined) {
            return;
        }

        const value = `${Number(this.value) / DEFAULT_FONT_SIZE}rem`;

        return {
            ...this.createWebToken(value, componentName),
        };
    }
}
