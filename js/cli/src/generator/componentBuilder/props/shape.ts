import { adjustedRadius } from '../../../web-mapping/index.ts';
import type { PlatformTokens, PropConfig, ThemeValues } from '../type.ts';
import { Prop } from './prop.ts';

export class ShapeProp extends Prop {
    protected readonly type = 'shape';

    constructor(name: string, data: PropConfig, platformTokens?: PlatformTokens) {
        super(name, data, platformTokens);
    }

    private getCSSVar(value: string | number) {
        const [, size] = value.toString().split('.');

        return `var(--border-radius-${size})`;
    }

    public getWebTokenValue(theme?: ThemeValues) {
        if (typeof this.value === 'number' || !this.value) {
            return;
        }

        const token = theme ? theme.getTokenValue(this.value, 'shape', 'web') : this.getCSSVar(this.value);

        const value = this.adjustment
            ? adjustedRadius(`${token}`, Number(this.adjustment))
            : `${token}`;

        return {
            ...this.createWebToken(value),
        };
    }
}
